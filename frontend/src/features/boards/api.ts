import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import { attachPhotoFile, markSaved, useCanvasStore } from "./store";
import type { BoardPatch, Moodboard } from "./types";

export const boardKeys = {
  all: ["boards"] as const,
  list: ["boards", "list"] as const,
  detail: (id: string) => ["boards", "detail", id] as const,
};

function toBoard(r: RecordModel): Moodboard {
  return {
    id: r.id,
    title: r.title,
    items: r.items ?? [],
    doodle: r.doodle ?? [],
    photos: r.photos ?? [],
    updated: r.updated,
  };
}

export function boardPhotoUrl(id: string, filename: string): string {
  return `${pb.baseURL}/api/files/moodboards/${id}/${encodeURIComponent(filename)}`;
}

export function useBoards() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: boardKeys.list,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("moodboards").getFullList({ sort: "-updated" });
      return records.map(toBoard);
    },
  });
}

export function useBoard(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: boardKeys.detail(id),
    enabled: isAuthenticated,
    queryFn: async () => toBoard(await pb.collection("moodboards").getOne(id)),
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      pb.collection("moodboards").create(
        { owner: pb.authStore.record!.id, title, items: [], doodle: [] },
        { requestKey: null },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
  });
}

/** Retitling, from the wall or from the canvas header. */
export function useRenameBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      pb.collection("moodboards").update(id, { title }, { requestKey: null }),
    onMutate: ({ id, title }) => {
      qc.setQueryData<Moodboard>(boardKeys.detail(id), (b) => (b ? { ...b, title } : b));
      qc.setQueryData<Moodboard[]>(boardKeys.list, (bs) =>
        bs?.map((b) => (b.id === id ? { ...b, title } : b)),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.list }),
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("moodboards").delete(id, { requestKey: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKeys.all }),
  });
}

/** A one-off patch that does not go through the canvas document — used by the
 * wall, which has no open board to edit. */
export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BoardPatch }) =>
      pb.collection("moodboards").update(id, patch, { requestKey: null }),
    onSuccess: (r) => {
      qc.setQueryData(boardKeys.detail(r.id), toBoard(r));
      qc.invalidateQueries({ queryKey: boardKeys.list });
    },
  });
}

/* --------------------------------------------------------------- autosave */

/** Write the canvas document back, then refresh the caches from what the
 * server actually stored. */
async function writeBoard(qc: QueryClient, id: string) {
  const { items, doodle, revision } = useCanvasStore.getState();
  const record = await pb
    .collection("moodboards")
    .update(id, { items, doodle }, { requestKey: null });
  markSaved(revision);
  const board = toBoard(record);
  qc.setQueryData(boardKeys.detail(id), board);
  qc.setQueryData<Moodboard[]>(boardKeys.list, (bs) =>
    bs?.map((b) => (b.id === id ? board : b)),
  );
}

/** How long the canvas stays quiet before a save goes out. Long enough that a
 * burst of edits is one write, short enough that nothing meaningful is in
 * flight when you put the phone down. */
const SAVE_DEBOUNCE = 700;

/** Persist the open board on a timer, and always on the way out.
 *
 * Nothing on the canvas ever waits for this: edits land in the document
 * immediately and this hook catches up behind them. Saves never overlap — a
 * write started while another is in flight is deferred until it lands, so a
 * fast burst of edits cannot deliver itself out of order. */
export function useBoardAutosave(id: string) {
  const qc = useQueryClient();
  const revision = useCanvasStore((s) => s.revision);
  const inFlight = useRef(false);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Keep writing until the document and the server agree: edits that
      // arrived during a write still need a home, and a second overlapping
      // request could deliver them out of order.
      for (;;) {
        const s = useCanvasStore.getState();
        if (s.boardId !== id || s.saved === s.revision) break;
        await writeBoard(qc, id);
      }
    } finally {
      inFlight.current = false;
    }
  }, [id, qc]);

  useEffect(() => {
    if (revision === 0) return;
    const timer = setTimeout(() => void save(), SAVE_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [revision, save]);

  // Leaving the screen, or the app going to the background, is a hard deadline.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") void save();
    });
    return () => {
      sub.remove();
      void save();
      void qc.invalidateQueries({ queryKey: boardKeys.list });
    };
  }, [save, qc]);
}

/* ------------------------------------------------------------------ photos */

/** Turn a picked image into something the PocketBase SDK can post. Native
 * hands us a file uri, the web hands us a blob url. */
async function toUpload(uri: string, name: string, type: string): Promise<Blob> {
  if (Platform.OS === "web") return (await fetch(uri)).blob();
  return { uri, name, type } as unknown as Blob;
}

/** Upload a picked photo and hand the stored filename back to the item that is
 * already sitting on the canvas. */
export async function uploadBoardPhoto(
  boardId: string,
  itemId: string,
  uri: string,
  mimeType: string | undefined,
) {
  // PocketBase names the file itself, so the only way to learn the name is to
  // diff the field around the upload.
  const current = await pb.collection("moodboards").getOne(boardId, { requestKey: null });
  const before = new Set<string>((current.photos as string[]) ?? []);
  const type = mimeType ?? "image/jpeg";
  const name = `photo-${itemId}.${type.split("/")[1] ?? "jpg"}`;
  const form = new FormData();
  form.append("photos+", await toUpload(uri, name, type));
  const record = await pb.collection("moodboards").update(boardId, form, { requestKey: null });
  const stored = (record.photos as string[]).find((f) => !before.has(f));
  if (stored) attachPhotoFile(itemId, stored);
}
