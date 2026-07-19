import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { ArrowLeft, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EditableText } from "@/components/editable";
import { INK_COLORS, strokePath, type InkColor, type Stroke } from "@/lib/doodle";
import { useAddBoardPhoto, useDeleteBoard, useRemoveBoardPhoto, useUpdateBoard } from "../api";
import {
  ASPECTS,
  DEFAULT_W,
  FOLDER_H,
  FOLDER_W,
  STICKERS,
  widthOf,
  type BoardItem,
  type GroupItem,
  type Moodboard,
  type PackDoodle,
  type PhotoFrame,
  type SectionItem,
} from "../types";
import { BoardObject } from "./BoardObject";
import {
  DockTool,
  FolderGlyph,
  PaperclipGlyph,
  PenGlyph,
  PolaroidGlyph,
  SectionGlyph,
  StampGlyph,
  StickerGlyph,
  StickyGlyph,
  TypeSlugGlyph,
} from "./BoardDock";
import { DoodleTray } from "./DoodleTray";

export const CANVAS_W = 1600;
export const CANVAS_H = 1100;
const NOTE_COLORS = ["honey", "sky", "leaf", "clay", "zest"] as const;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** A free-form mood board: notes, links, stickers, photos, doodles, sections
 * and folders you drag anywhere, plus a freehand drawing layer over the whole
 * canvas. */
export function BoardCanvas({ board }: { board: Moodboard }) {
  const navigate = useNavigate();
  const update = useUpdateBoard();
  const addPhoto = useAddBoardPhoto();
  const removePhoto = useRemoveBoardPhoto();
  const del = useDeleteBoard();

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [ink, setInk] = useState<InkColor>("zest");
  const [live, setLive] = useState<[number, number][] | null>(null);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [doodlesOpen, setDoodlesOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState<{ file: File; url: string; natural: number } | null>(null);
  // Folder currently spread open (one at a time).
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  // A section drag in flight: which items ride along, and by how much (live).
  const sectionDrag = useRef<{ id: string; members: string[] } | null>(null);
  const [followIds, setFollowIds] = useState<string[] | null>(null);
  const shiftX = useMotionValue(0);
  const shiftY = useMotionValue(0);
  // The folder/section a loose item is being dragged over (drop feedback).
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const lastTarget = useRef<string | null>(null);

  const commitItems = (items: BoardItem[]) => update.mutate({ id: board.id, patch: { items } });
  const updateItem = (id: string, partial: Partial<BoardItem>) =>
    commitItems(board.items.map((i) => (i.id === id ? ({ ...i, ...partial } as BoardItem) : i)));

  /** A spot near the middle of what's currently on screen, lightly jittered. */
  const dropPoint = () => {
    const el = scrollRef.current;
    const cx = el ? el.scrollLeft + el.clientWidth / 2 : CANVAS_W / 2;
    const cy = el ? el.scrollTop + el.clientHeight / 2 : CANVAS_H / 2;
    return { x: Math.round(cx + rand(-40, 40) - 88), y: Math.round(cy + rand(-40, 40) - 40) };
  };
  const add = (item: BoardItem) => {
    commitItems([...board.items, item]);
    setSelected(item.id);
  };
  const uid = () => crypto.randomUUID();

  const addNote = () => {
    const p = dropPoint();
    add({ id: uid(), kind: "note", ...p, text: "", color: NOTE_COLORS[Math.floor(rand(0, NOTE_COLORS.length))] });
  };
  const addLink = () => add({ id: uid(), kind: "link", ...dropPoint(), url: "", label: "" });
  const addText = () => add({ id: uid(), kind: "text", ...dropPoint(), text: "", w: 200 });
  const addSection = () => {
    const p = dropPoint();
    add({ id: uid(), kind: "section", x: p.x - 120, y: p.y - 100, w: 420, h: 300, label: "Section", color: "sky" });
  };
  const addFolder = () => {
    const p = dropPoint();
    add({ id: uid(), kind: "group", ...p, w: 340, h: 240, label: "Folder", color: "zest" });
  };
  const addSticker = (emoji: string) => {
    setStickersOpen(false);
    add({ id: uid(), kind: "sticker", ...dropPoint(), emoji, rot: rand(-14, 14) });
  };
  const placeDoodle = (d: Pick<PackDoodle, "strokes" | "aspect">) =>
    add({
      id: uid(),
      kind: "doodle",
      ...dropPoint(),
      w: DEFAULT_W.doodle,
      aspect: d.aspect,
      strokes: d.strokes,
      rot: rand(-5, 5),
    });
  // Photo import runs through a small dialog so the frame (plain / polaroid)
  // and — for a polaroid — the crop can be chosen before it lands.
  const openPhoto = async (file: File) => {
    const bmp = await createImageBitmap(file).catch(() => null);
    const natural = bmp ? bmp.width / bmp.height : 1;
    bmp?.close();
    setPhotoDraft({ file, url: URL.createObjectURL(file), natural });
  };
  const placePhoto = (frame: PhotoFrame, aspect: number) => {
    if (!photoDraft) return;
    const p = dropPoint();
    addPhoto.mutate({
      board,
      file: photoDraft.file,
      item: { id: uid(), kind: "photo", ...p, w: 176, rot: rand(-6, 6), frame, aspect },
    });
    URL.revokeObjectURL(photoDraft.url);
    setPhotoDraft(null);
  };

  const deleteItem = (item: BoardItem) => {
    let after = board.items.filter((i) => i.id !== item.id);
    // Deleting a folder spills its contents back onto the canvas.
    if (item.kind === "group")
      after = after.map((i) => (i.parent === item.id ? ({ ...i, parent: "" } as BoardItem) : i));
    if (item.kind === "photo" && item.file)
      removePhoto.mutate({ id: board.id, items: after, removeFile: item.file });
    else commitItems(after);
    setSelected(null);
  };

  /** The point that decides containment: the item's top-center-ish anchor. */
  const anchorIn = (item: BoardItem, x: number, y: number, r: { x: number; y: number; w: number; h: number }) => {
    const ax = x + widthOf(item) / 2;
    const ay = y + 20;
    return ax >= r.x && ax <= r.x + r.w && ay >= r.y && ay <= r.y + r.h;
  };
  const folderRect = (f: GroupItem) => ({ x: f.x, y: f.y, w: FOLDER_W, h: FOLDER_H });

  /** The folder or section a loose item's anchor is over right now (folders
   * win — they physically contain; a section merely groups by position). */
  const targetAt = (item: BoardItem, x: number, y: number): string | null => {
    const folder = board.items.find(
      (f): f is GroupItem => f.kind === "group" && !f.parent && anchorIn(item, x, y, folderRect(f)),
    );
    if (folder) return folder.id;
    const section = board.items.find(
      (s): s is SectionItem =>
        s.kind === "section" && anchorIn(item, x, y, { x: s.x, y: s.y, w: s.w, h: s.h }),
    );
    return section?.id ?? null;
  };
  const onLooseDragMove = (item: BoardItem, dx: number, dy: number) => {
    const t = targetAt(item, item.x + dx, item.y + dy);
    if (t !== lastTarget.current) {
      lastTarget.current = t;
      setDropTarget(t);
    }
  };
  const clearDropTarget = () => {
    if (lastTarget.current !== null) {
      lastTarget.current = null;
      setDropTarget(null);
    }
  };

  /** When a section starts moving, everything sitting inside rides along. */
  const startSectionDrag = (s: SectionItem) => {
    const members = board.items
      .filter(
        (i) =>
          i.id !== s.id &&
          !i.parent &&
          i.kind !== "section" &&
          anchorIn(i, i.x, i.y, { x: s.x, y: s.y, w: s.w, h: s.h }),
      )
      .map((i) => i.id);
    sectionDrag.current = { id: s.id, members };
    setFollowIds(members);
  };

  const handleCommit = (item: BoardItem, partial: Partial<BoardItem>) => {
    // A section drop: commit the section and everything it carried in one write.
    if (
      item.kind === "section" &&
      sectionDrag.current?.id === item.id &&
      partial.x != null &&
      partial.y != null
    ) {
      const dx = partial.x - item.x;
      const dy = partial.y - item.y;
      const mem = new Set(sectionDrag.current.members);
      commitItems(
        board.items.map((i) =>
          i.id === item.id
            ? { ...i, x: partial.x!, y: partial.y! }
            : mem.has(i.id)
              ? { ...i, x: Math.round(i.x + dx), y: Math.round(i.y + dy) }
              : i,
        ),
      );
      sectionDrag.current = null;
      setFollowIds(null);
      shiftX.set(0);
      shiftY.set(0);
      return;
    }
    // Dropping something onto a folder tucks it inside.
    if (partial.x != null && partial.y != null && item.kind !== "group" && item.kind !== "section") {
      const folder = board.items.find(
        (f): f is GroupItem =>
          f.kind === "group" && !f.parent && anchorIn(item, partial.x!, partial.y!, folderRect(f)),
      );
      if (folder) {
        updateItem(item.id, { ...partial, parent: folder.id });
        setSelected(null);
        return;
      }
    }
    updateItem(item.id, partial);
  };

  const eject = (folder: GroupItem, memberId: string) => {
    updateItem(memberId, {
      parent: "",
      x: Math.round(folder.x + FOLDER_W + rand(20, 60)),
      y: Math.round(folder.y + rand(-10, 50)),
    });
  };

  const pointOnCanvas = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      {/* Board chrome */}
      <header className="flex items-center gap-3 border-b border-rule/60 bg-surface/80 px-4 py-2.5 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate({ to: "/boards" })}
          aria-label="All boards"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <EditableText
          value={board.title}
          ariaLabel="Board title"
          onCommit={(title) => update.mutate({ id: board.id, patch: { title } })}
          className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight text-ink"
          inputClassName="font-display text-lg font-bold tracking-tight"
        />
        <button
          type="button"
          onClick={() => {
            del.mutate(board.id);
            navigate({ to: "/boards" });
          }}
          aria-label="Delete board"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-clay"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* Canvas */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto" onPointerDown={() => setSelected(null)}>
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            backgroundImage: "radial-gradient(hsl(var(--rule)) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        >
          {/* Committed doodle + live stroke */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0"
            width={CANVAS_W}
            height={CANVAS_H}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          >
            {board.doodle.map((s, i) => (
              <path
                key={i}
                d={strokePath(s.points)}
                fill="none"
                stroke={`hsl(var(--${s.color}))`}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ))}
            {live && live.length > 1 && (
              <path
                d={strokePath(live)}
                fill="none"
                stroke={`hsl(var(--${ink}))`}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )}
          </svg>

          {board.items
            .filter((i) => !i.parent)
            .map((item) => (
              <BoardObject
                key={item.id}
                boardId={board.id}
                item={item}
                canvasRef={canvasRef}
                selected={selected === item.id}
                onSelect={() => !drawing && setSelected(item.id)}
                onCommit={(partial) => handleCommit(item, partial)}
                onDelete={() => deleteItem(item)}
                shiftX={shiftX}
                shiftY={shiftY}
                following={!!followIds?.includes(item.id)}
                isDropTarget={dropTarget === item.id}
                onDragStartItem={item.kind === "section" ? () => startSectionDrag(item) : undefined}
                onDragMove={
                  item.kind === "section"
                    ? (dx, dy) => {
                        shiftX.set(dx);
                        shiftY.set(dy);
                      }
                    : item.kind === "group"
                      ? undefined
                      : (dx, dy) => onLooseDragMove(item, dx, dy)
                }
                onDragEndItem={clearDropTarget}
                open={item.kind === "group" ? openFolder === item.id : undefined}
                onToggleOpen={
                  item.kind === "group"
                    ? () => setOpenFolder((c) => (c === item.id ? null : item.id))
                    : undefined
                }
                members={item.kind === "group" ? board.items.filter((m) => m.parent === item.id) : undefined}
                onEject={item.kind === "group" ? (mid) => eject(item, mid) : undefined}
              />
            ))}

          {/* Draw capture layer */}
          {drawing && (
            <div
              className="absolute inset-0 z-[40] cursor-crosshair touch-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setLive([pointOnCanvas(e)]);
              }}
              onPointerMove={(e) => {
                if (!live) return;
                const p = pointOnCanvas(e);
                const last = live[live.length - 1];
                if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 2) setLive([...live, p]);
              }}
              onPointerUp={() => {
                if (live && live.length > 1)
                  update.mutate({
                    id: board.id,
                    patch: { doodle: [...board.doodle, { color: ink, points: live } as Stroke] },
                  });
                setLive(null);
              }}
            />
          )}
        </div>
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openPhoto(f);
          e.target.value = "";
        }}
      />

      <AnimatePresence>
        {photoDraft && (
          <PhotoImportDialog
            draft={photoDraft}
            onCancel={() => {
              URL.revokeObjectURL(photoDraft.url);
              setPhotoDraft(null);
            }}
            onConfirm={placePhoto}
          />
        )}
      </AnimatePresence>

      {/* Tool shelf */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="pointer-events-auto relative">
          <AnimatePresence>
            {stickersOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                className="absolute bottom-full left-1/2 mb-2 grid w-52 -translate-x-1/2 grid-cols-6 gap-0.5 rounded-2xl border border-rule/70 bg-surface p-2 shadow-soft"
              >
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSticker(s)}
                    className="rounded-lg p-1 text-xl transition-[background-color,transform] hover:bg-ink/[0.05] active:scale-90"
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {doodlesOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 480, damping: 34 }}
                className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-2xl border border-rule/70 bg-surface p-3 shadow-soft"
              >
                <DoodleTray onPlace={placeDoodle} onClose={() => setDoodlesOpen(false)} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grain flex items-end gap-0.5 rounded-2xl border border-rule/70 bg-surface/95 px-2 pt-1 shadow-soft backdrop-blur-md">
            <DockTool label="Text" onClick={addText}>
              <TypeSlugGlyph />
            </DockTool>
            <DockTool label="Sticky note" onClick={addNote}>
              <StickyGlyph />
            </DockTool>
            <DockTool label="Link" onClick={addLink}>
              <PaperclipGlyph />
            </DockTool>
            <DockTool
              label="Sticker"
              active={stickersOpen}
              onClick={() => {
                setStickersOpen((o) => !o);
                setDoodlesOpen(false);
              }}
            >
              <StickerGlyph />
            </DockTool>
            <DockTool label="Photo" onClick={() => photoInput.current?.click()}>
              <PolaroidGlyph />
            </DockTool>
            <DockTool
              label="Doodle packs"
              active={doodlesOpen}
              onClick={() => {
                setDoodlesOpen((o) => !o);
                setStickersOpen(false);
              }}
            >
              <StampGlyph />
            </DockTool>
            <DockTool label="Section" onClick={addSection}>
              <SectionGlyph />
            </DockTool>
            <DockTool label="Folder" onClick={addFolder}>
              <FolderGlyph />
            </DockTool>
            <span className="mx-1 mb-2 h-7 w-px self-end bg-rule/70" aria-hidden />
            <DockTool
              label={drawing ? "Stop drawing" : "Draw"}
              active={drawing}
              onClick={() => {
                setDrawing((d) => !d);
                setSelected(null);
              }}
            >
              <PenGlyph raised={drawing} />
            </DockTool>
            <AnimatePresence>
              {drawing && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="mb-3 flex items-center gap-1 self-end overflow-hidden pl-0.5 pr-1"
                >
                  {INK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`${c} ink`}
                      onClick={() => setInk(c)}
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full transition-transform active:scale-90",
                        ink === c && "ring-2 ring-ink/30 ring-offset-1 ring-offset-surface",
                      )}
                      style={{ backgroundColor: `hsl(var(--${c}))` }}
                    />
                  ))}
                  {board.doodle.length > 0 && (
                    <button
                      type="button"
                      aria-label="Undo last stroke"
                      onClick={() =>
                        update.mutate({ id: board.id, patch: { doodle: board.doodle.slice(0, -1) } })
                      }
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The photo import sheet: pick a frame, and for a polaroid pick the crop —
 * with a live preview so you see the framing before it lands. */
function PhotoImportDialog({
  draft,
  onConfirm,
  onCancel,
}: {
  draft: { file: File; url: string; natural: number };
  onConfirm: (frame: PhotoFrame, aspect: number) => void;
  onCancel: () => void;
}) {
  const [frame, setFrame] = useState<PhotoFrame>("plain");
  const [aspect, setAspect] = useState(1);
  const framed = frame !== "plain";
  // Plain shows the whole image at its natural ratio; a frame crops to `aspect`.
  const previewAspect = framed ? aspect : draft.natural;

  return (
    <>
      <motion.button
        type="button"
        aria-label="Cancel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-[60] bg-ink/30"
      />
      <motion.div
        role="dialog"
        aria-label="Add photo"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="grain fixed left-1/2 top-1/2 z-[60] w-[19rem] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-rule/70 bg-surface p-5 shadow-soft"
      >
        <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-muted">add photo</span>

        <div className="mt-3 flex justify-center">
          <span
            className={cn(
              "block w-40",
              frame === "polaroid" && "grain border border-black/10 bg-white p-2 pb-6 shadow-soft",
              frame === "stamp" && "stamp-edge grain bg-white p-1.5 shadow-soft",
              frame === "plain" && "overflow-hidden rounded-lg shadow-soft",
            )}
          >
            <img
              src={draft.url}
              alt=""
              style={{ aspectRatio: previewAspect }}
              className={cn("w-full", framed ? "object-cover" : "object-contain")}
            />
          </span>
        </div>

        <div className="mt-4 inset-well flex rounded-full bg-ink/5 p-1">
          {(["plain", "polaroid", "stamp"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrame(f)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-xs font-medium capitalize transition-colors",
                frame === f ? "bg-surface text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {framed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted">crop</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ASPECTS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => setAspect(a.value)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                      Math.abs(aspect - a.value) < 0.02
                        ? "bg-zest text-paper"
                        : "border border-rule text-ink-muted hover:text-ink",
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3.5 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(frame, framed ? aspect : draft.natural)}
            className="rounded-full bg-zest px-5 py-2 text-xs font-semibold text-paper shadow-soft"
          >
            Add
          </button>
        </div>
      </motion.div>
    </>
  );
}
