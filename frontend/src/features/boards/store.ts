import { create } from "zustand";
import type { Stroke } from "@/lib/doodle";
import type { BoardItem, Moodboard } from "./types";

/** The open board, while you are editing it.
 *
 * Server state is TanStack Query everywhere else in the app, and it still owns
 * *loading* a board and the wall of boards. It cannot own the canvas: an editor
 * needs a document it can undo, and every edit has to land before the network
 * is consulted, not after. So the canvas hydrates this document once on open,
 * edits it locally, and the screen flushes it back on a timer (see
 * `useBoardAutosave`). One direction, one owner at a time.
 *
 * Everything transient — what is selected, which tool is up, which ink is
 * loaded — stays in the canvas component. It changes on its own clock and does
 * not belong in the document's history. */

/** One point in time. Items and strokes are swapped wholesale rather than
 * patched, so an undo entry is a plain reference and costs nothing to keep. */
interface Snapshot {
  items: BoardItem[];
  doodle: Stroke[];
}

/** Deep enough to cover a session's worth of mistakes, shallow enough that a
 * board full of long drawings never pins real memory. */
const HISTORY_LIMIT = 50;

interface CanvasStore extends Snapshot {
  boardId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  /** Bumped on every committed edit. The autosave hook watches this rather
   * than the arrays, so it can tell "changed" from "re-rendered". */
  revision: number;
  /** Revision last written to the server. Equal to `revision` means saved. */
  saved: number;
}

const EMPTY: Snapshot = { items: [], doodle: [] };

export const useCanvasStore = create<CanvasStore>(() => ({
  boardId: null,
  ...EMPTY,
  past: [],
  future: [],
  revision: 0,
  saved: 0,
}));

/** Load a board into the canvas. Re-opening the same board is ignored, so a
 * refetch landing mid-edit cannot overwrite what is on screen. */
export function openBoard(board: Moodboard) {
  if (useCanvasStore.getState().boardId === board.id) return;
  useCanvasStore.setState({
    boardId: board.id,
    items: board.items,
    doodle: board.doodle,
    past: [],
    future: [],
    revision: 0,
    saved: 0,
  });
}

export function closeBoard() {
  pending = null;
  useCanvasStore.setState({ boardId: null, ...EMPTY, past: [], future: [], revision: 0, saved: 0 });
}

/** Record an edit. One call is one undo step, so a whole drag, a whole resize
 * or a whole typing session commits once, on release, not per frame. */
export function commit(patch: Partial<Snapshot>) {
  useCanvasStore.setState((s) => ({
    items: patch.items ?? s.items,
    doodle: patch.doodle ?? s.doodle,
    past: [...s.past, { items: s.items, doodle: s.doodle }].slice(-HISTORY_LIMIT),
    future: [],
    revision: s.revision + 1,
  }));
}

/** Edit the item list through a mapper — the shape almost every tool needs. */
export function commitItems(next: (items: BoardItem[]) => BoardItem[]) {
  commit({ items: next(useCanvasStore.getState().items) });
}

/** Patch one item by id. */
export function patchItem(id: string, partial: Partial<BoardItem>) {
  commitItems((items) =>
    items.map((i) => (i.id === id ? ({ ...i, ...partial } as BoardItem) : i)),
  );
}

export function addItem(item: BoardItem) {
  commitItems((items) => [...items, item]);
}

export function removeItem(id: string) {
  commitItems((items) => items.filter((i) => i.id !== id));
}

/** An edit that runs continuously under a finger — rubbing out ink — cannot
 * commit per frame without filling the history with sixty identical steps. It
 * opens with `beginGesture`, updates the document freely, and closes with
 * `endGesture`, which lands the whole thing as one undo. */
let pending: Snapshot | null = null;

export function beginGesture() {
  const { items, doodle } = useCanvasStore.getState();
  pending = { items, doodle };
}

export function liveDoodle(doodle: Stroke[]) {
  useCanvasStore.setState((s) => ({ doodle, revision: s.revision + 1 }));
}

export function endGesture() {
  const opened = pending;
  pending = null;
  if (!opened) return;
  const { items, doodle } = useCanvasStore.getState();
  if (opened.items === items && opened.doodle === doodle) return;
  useCanvasStore.setState((s) => ({
    past: [...s.past, opened].slice(-HISTORY_LIMIT),
    future: [],
  }));
}

export function undo() {
  useCanvasStore.setState((s) => {
    const prev = s.past[s.past.length - 1];
    if (!prev) return s;
    return {
      ...prev,
      past: s.past.slice(0, -1),
      future: [{ items: s.items, doodle: s.doodle }, ...s.future].slice(0, HISTORY_LIMIT),
      revision: s.revision + 1,
    };
  });
}

export function redo() {
  useCanvasStore.setState((s) => {
    const next = s.future[0];
    if (!next) return s;
    return {
      ...next,
      past: [...s.past, { items: s.items, doodle: s.doodle }].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      revision: s.revision + 1,
    };
  });
}

/** Mark everything up to `revision` as written. */
export function markSaved(revision: number) {
  useCanvasStore.setState({ saved: revision });
}

/** Local uris for photos that are on the canvas but not yet uploaded, keyed by
 * item id. A picked photo appears the instant you pick it and uploads behind
 * you, so the draft uri is what gets drawn until the server has a name for it.
 * Deliberately outside the document: it is a fact about this device, not about
 * the board, and it must never be persisted or undone into. */
export const usePhotoDrafts = create<Record<string, string>>(() => ({}));

export function setPhotoDraft(itemId: string, uri: string) {
  usePhotoDrafts.setState({ [itemId]: uri });
}

/** A photo lands in two steps: the file uploads, then PocketBase tells us the
 * name it stored it under. That name arrives outside the edit loop, so it is
 * folded into the document *and* into the history, so that undoing back over
 * the photo and redoing forward again does not lose the file. */
export function attachPhotoFile(itemId: string, file: string) {
  const name = (i: BoardItem) => (i.id === itemId && i.kind === "photo" ? { ...i, file } : i);
  useCanvasStore.setState((s) => ({
    items: s.items.map(name),
    past: s.past.map((snap) => ({ ...snap, items: snap.items.map(name) })),
    future: s.future.map((snap) => ({ ...snap, items: snap.items.map(name) })),
    // The filename is real content: it has to reach the server.
    revision: s.revision + 1,
  }));
  usePhotoDrafts.setState((drafts) => {
    const rest = { ...drafts };
    delete rest[itemId];
    return rest;
  }, true);
}
