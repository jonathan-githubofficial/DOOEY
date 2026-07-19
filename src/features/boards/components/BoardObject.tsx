import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { ExternalLink, Maximize2, RotateCw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { FolderShell } from "@/components/icons/folder-shell";
import { boardPhotoUrl } from "../api";
import {
  ASPECTS,
  DEFAULT_W,
  FOLDER_H,
  FOLDER_W,
  STICKERS,
  TEXT_DEFAULTS,
  TEXT_FONT_CLASS,
  TEXT_WEIGHTS,
  widthOf,
  type BoardItem,
  type GroupColor,
  type NoteColor,
  type PhotoFrame,
  type TextFont,
} from "../types";
import { DoodleGlyph } from "./DoodleGlyph";

const NOTE_BG: Record<NoteColor, string> = {
  honey: "bg-honey/25",
  sky: "bg-sky/20",
  leaf: "bg-leaf/20",
  clay: "bg-clay/20",
  zest: "bg-zest/20",
};
const ZONE_COLORS: GroupColor[] = ["sky", "leaf", "zest", "clay"];
const ZONE_BORDER: Record<GroupColor, string> = {
  sky: "border-sky/50",
  leaf: "border-leaf/50",
  zest: "border-zest/50",
  clay: "border-clay/50",
};
const ZONE_TINT: Record<GroupColor, string> = {
  sky: "bg-sky/[0.07]",
  leaf: "bg-leaf/[0.07]",
  zest: "bg-zest/[0.07]",
  clay: "bg-clay/[0.07]",
};
/** Brighter fill while a loose item hovers over a section. */
const ZONE_HOT: Record<GroupColor, string> = {
  sky: "bg-sky/[0.16]",
  leaf: "bg-leaf/[0.16]",
  zest: "bg-zest/[0.16]",
  clay: "bg-clay/[0.16]",
};

type LivePatch = { rot?: number; w?: number; h?: number; size?: number } | null;

/** One placed board element. Position lives in motion values (px on the
 * canvas) so a drag never fights React's re-render; the drop commits the
 * settled coords. Selected, it shows a delete handle and inline editors. */
export function BoardObject({
  boardId,
  item,
  canvasRef,
  selected,
  onSelect,
  onCommit,
  onDelete,
  shiftX,
  shiftY,
  following,
  onDragStartItem,
  onDragMove,
  onDragEndItem,
  open,
  onToggleOpen,
  members,
  onEject,
  isDropTarget,
}: {
  boardId: string;
  item: BoardItem;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selected: boolean;
  onSelect: () => void;
  onCommit: (partial: Partial<BoardItem>) => void;
  onDelete: () => void;
  /** Live offset of the section drag in progress; items with `following` ride it. */
  shiftX: MotionValue<number>;
  shiftY: MotionValue<number>;
  following: boolean;
  onDragStartItem?: () => void;
  onDragMove?: (dx: number, dy: number) => void;
  onDragEndItem?: () => void;
  /** Folder (group) plumbing. */
  open?: boolean;
  onToggleOpen?: () => void;
  members?: BoardItem[];
  onEject?: (memberId: string) => void;
  /** A loose item is being dragged over this folder/section right now. */
  isDropTarget?: boolean;
}) {
  const x = useMotionValue(item.x);
  const y = useMotionValue(item.y);
  const dragging = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  // Live preview of a rotate/scale/resize gesture before it commits.
  const [live, setLive] = useState<LivePatch>(null);
  // Keep in sync if the item moves from elsewhere (realtime / section carry).
  // Layout effect so a section drop repositions before paint — no jump frame.
  useLayoutEffect(() => {
    if (!dragging.current) {
      x.set(item.x);
      y.set(item.y);
    }
  }, [item.x, item.y, x, y]);

  // While a section is dragged, everything inside it rides along visually;
  // the real coordinates commit on drop.
  const followX = useTransform(() => (following ? shiftX.get() : 0));
  const followY = useTransform(() => (following ? shiftY.get() : 0));

  const isZone = item.kind === "section";
  const isFolder = item.kind === "group";
  const displayRot = live?.rot ?? item.rot ?? 0;
  const zIndex = isZone ? 1 : isFolder ? (open || selected ? 35 : 12) : selected ? 30 : 10;

  return (
    <motion.div
      style={{ x, y, zIndex }}
      drag={!live}
      dragMomentum={false}
      dragConstraints={canvasRef}
      // Stop the pointer reaching the canvas's deselect handler — otherwise the
      // item is selected and instantly deselected, so it's only editable at
      // creation. Selecting here is what makes items editable afterwards.
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onTap={() => isFolder && onToggleOpen?.()}
      onDragStart={() => {
        dragging.current = true;
        onDragStartItem?.();
      }}
      onDrag={(_e, info) => onDragMove?.(info.offset.x, info.offset.y)}
      onDragEnd={() => {
        dragging.current = false;
        onDragEndItem?.();
        onCommit({ x: Math.round(x.get()), y: Math.round(y.get()) });
      }}
      className="absolute left-0 top-0 cursor-grab touch-none active:cursor-grabbing"
    >
      <motion.div
        ref={boxRef}
        style={{ x: followX, y: followY, rotate: displayRot }}
        className={cn(
          "relative",
          selected && "outline-2 outline-offset-4 outline-dashed outline-zest/60 rounded-lg",
        )}
      >
        <ItemBody
          boardId={boardId}
          item={item}
          selected={selected}
          live={live}
          onCommit={onCommit}
          open={open}
          members={members}
          onEject={onEject}
          isDropTarget={isDropTarget}
        />
        {selected && (
          <button
            type="button"
            aria-label="Remove"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            className="absolute -right-2.5 -top-2.5 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-rule bg-surface text-ink-muted shadow-soft transition-colors hover:text-clay"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
        {selected && (
          <Handles
            boxRef={boxRef}
            kind={item.kind}
            baseRot={item.rot ?? 0}
            baseW={isZone ? item.w : widthOf(item)}
            baseH={isZone ? item.h : 0}
            baseSize={item.kind === "text" ? (item.size ?? TEXT_DEFAULTS.size) : 0}
            onLive={setLive}
            onCommit={(patch) => {
              onCommit(patch);
              setLive(null);
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

/** Rotate (top) + resize (bottom-right corner) handles for any item. Links
 * and folders (fixed-size objects) rotate but don't resize; sections resize
 * in both axes; text scales its font together with its width. The gesture
 * lives on the handle (pointer capture) so it never fights the item's own
 * drag. */
function Handles({
  boxRef,
  kind,
  baseRot,
  baseW,
  baseH,
  baseSize,
  onLive,
  onCommit,
}: {
  boxRef: React.RefObject<HTMLDivElement | null>;
  kind: BoardItem["kind"];
  baseRot: number;
  baseW: number;
  baseH: number;
  baseSize: number;
  onLive: (t: LivePatch) => void;
  onCommit: (patch: NonNullable<LivePatch>) => void;
}) {
  const gesture = useRef<
    | { g: "rot"; cx: number; cy: number; base: number }
    | { g: "size"; startX: number; startY: number }
    | null
  >(null);
  const resizable = kind !== "link" && kind !== "group";
  const twoD = kind === "section";
  const clampW = (v: number) =>
    kind === "sticker"
      ? Math.round(Math.min(240, Math.max(24, v)))
      : Math.round(Math.min(900, Math.max(kind === "doodle" ? 40 : 72, v)));
  const clampH = (v: number) => Math.round(Math.min(760, Math.max(80, v)));

  const patchFor = (e: React.PointerEvent): NonNullable<LivePatch> => {
    const gc = gesture.current!;
    if (gc.g === "rot") {
      const a = Math.atan2(e.clientY - gc.cy, e.clientX - gc.cx);
      return { rot: Math.round(baseRot + ((a - gc.base) * 180) / Math.PI) };
    }
    const w = clampW(baseW + (e.clientX - gc.startX));
    return {
      w,
      ...(twoD ? { h: clampH(baseH + (e.clientY - gc.startY)) } : {}),
      // Text scales its type with the box, so bigger box = bigger words.
      ...(kind === "text" ? { size: Math.round(baseSize * (w / baseW) * 10) / 10 } : {}),
    };
  };

  return (
    <>
      <button
        type="button"
        aria-label="Rotate"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = boxRef.current!.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          gesture.current = { g: "rot", cx, cy, base: Math.atan2(e.clientY - cy, e.clientX - cx) };
        }}
        onPointerMove={(e) => {
          if (!gesture.current) return;
          e.stopPropagation();
          onLive(patchFor(e));
        }}
        onPointerUp={(e) => {
          if (!gesture.current) return;
          e.stopPropagation();
          onCommit(patchFor(e));
          gesture.current = null;
        }}
        className="absolute -top-9 left-1/2 z-40 flex h-6 w-6 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border border-rule bg-surface text-ink-muted shadow-soft active:cursor-grabbing"
      >
        <RotateCw className="h-3 w-3" />
      </button>
      {resizable && (
        <button
          type="button"
          aria-label="Resize"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            gesture.current = { g: "size", startX: e.clientX, startY: e.clientY };
          }}
          onPointerMove={(e) => {
            if (!gesture.current) return;
            e.stopPropagation();
            onLive(patchFor(e));
          }}
          onPointerUp={(e) => {
            if (!gesture.current) return;
            e.stopPropagation();
            onCommit(patchFor(e));
            gesture.current = null;
          }}
          className="absolute -bottom-2.5 -right-2.5 z-40 flex h-6 w-6 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-rule bg-surface text-ink-muted shadow-soft"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      )}
    </>
  );
}

function ItemBody({
  boardId,
  item,
  selected,
  live,
  onCommit,
  open,
  members,
  onEject,
  isDropTarget,
}: {
  boardId: string;
  item: BoardItem;
  selected: boolean;
  live?: LivePatch;
  onCommit: (partial: Partial<BoardItem>) => void;
  open?: boolean;
  members?: BoardItem[];
  onEject?: (memberId: string) => void;
  isDropTarget?: boolean;
}) {
  switch (item.kind) {
    case "section":
      return (
        <SectionBody
          item={item}
          selected={selected}
          live={live}
          isDropTarget={isDropTarget}
          onCommit={onCommit}
        />
      );
    case "group":
      return (
        <FolderBody
          boardId={boardId}
          item={item}
          selected={selected}
          open={!!open}
          members={members ?? []}
          isDropTarget={isDropTarget}
          onCommit={onCommit}
          onEject={onEject}
        />
      );
    case "note":
      return (
        <NoteBody
          text={item.text}
          color={item.color}
          w={live?.w ?? item.w ?? DEFAULT_W.note}
          selected={selected}
          onCommit={(text) => onCommit({ text })}
        />
      );
    case "text":
      return (
        <TextBody
          item={item}
          w={live?.w ?? item.w}
          size={live?.size ?? item.size ?? TEXT_DEFAULTS.size}
          selected={selected}
          onCommit={onCommit}
        />
      );
    case "doodle":
      return (
        <DoodleGlyph
          strokes={item.strokes}
          aspect={item.aspect}
          width={live?.w ?? item.w}
          className="block select-none"
        />
      );
    case "sticker":
      return (
        <>
          <span
            style={{ fontSize: live?.w ?? item.w ?? DEFAULT_W.sticker }}
            className="block select-none leading-none drop-shadow-[0_2px_2px_rgb(40_32_24/0.25)]"
          >
            {item.emoji}
          </span>
          {selected && <StickerControls onPick={(emoji) => onCommit({ emoji })} />}
        </>
      );
    case "photo": {
      const width = live?.w ?? item.w;
      const framed = item.frame !== "plain";
      const img = item.file && (
        <img
          src={boardPhotoUrl(boardId, item.file)}
          alt=""
          draggable={false}
          style={{ aspectRatio: item.aspect }}
          className={cn("w-full", framed ? "object-cover" : "object-contain")}
        />
      );
      return (
        <>
          <span
            style={{ width }}
            className={cn(
              "block",
              item.frame === "polaroid" && "grain border border-black/10 bg-white p-2 pb-6 shadow-soft",
              item.frame === "stamp" && "stamp-edge grain bg-white p-1.5 shadow-soft",
              item.frame === "plain" && "overflow-hidden rounded-lg shadow-soft",
            )}
          >
            {img}
          </span>
          {selected && <PhotoControls item={item} onCommit={onCommit} />}
        </>
      );
    }
    case "link":
      return <LinkBody url={item.url} label={item.label} selected={selected} onCommit={onCommit} />;
  }
}

/** A section: a labelled region on the board. A solid header bar names it (so
 * it never reads as a folder), and a dashed translucent body marks its
 * footprint. Anything sitting inside rides along when the section moves. */
function SectionBody({
  item,
  selected,
  live,
  isDropTarget,
  onCommit,
}: {
  item: Extract<BoardItem, { kind: "section" }>;
  selected: boolean;
  live?: LivePatch;
  isDropTarget?: boolean;
  onCommit: (partial: Partial<BoardItem>) => void;
}) {
  return (
    <motion.div
      animate={{ scale: isDropTarget ? 1.01 : 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      style={{ width: live?.w ?? item.w, height: live?.h ?? item.h }}
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
        ZONE_BORDER[item.color],
        isDropTarget ? ZONE_HOT[item.color] : ZONE_TINT[item.color],
      )}
    >
      {/* Header bar — the section's identity, distinct from a folder tab. */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{ background: `color-mix(in srgb, hsl(var(--${item.color})) 22%, transparent)` }}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-[3px]"
          style={{ backgroundColor: `hsl(var(--${item.color}))` }}
          aria-hidden
        />
        <EditableLabel
          value={item.label}
          fallback="Section"
          selected={selected}
          onCommit={(label) => onCommit({ label })}
          className="min-w-0 flex-1 truncate bg-transparent text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted"
        />
      </div>
      {isDropTarget && (
        <span className="m-auto rounded-full bg-surface/85 px-2.5 py-1 text-[10px] font-medium text-ink shadow-soft">
          Group into “{item.label || "Section"}”
        </span>
      )}
      {selected && <ZoneColors current={item.color} onPick={(color) => onCommit({ color })} />}
    </motion.div>
  );
}

/** A folder on the canvas: a contoured shell. Closed, its contents peek out of
 * the mouth. Tap it and it lifts open into a tidy tray above the folder — a
 * small backing panel with the pieces laid out in a grid, each springing in.
 * Tap a piece to take it out; tap the folder (or ✕) to tuck them back in. */
function FolderBody({
  boardId,
  item,
  selected,
  open,
  members,
  isDropTarget,
  onCommit,
  onEject,
}: {
  boardId: string;
  item: Extract<BoardItem, { kind: "group" }>;
  selected: boolean;
  open: boolean;
  members: BoardItem[];
  isDropTarget?: boolean;
  onCommit: (partial: Partial<BoardItem>) => void;
  onEject?: (memberId: string) => void;
}) {
  const hue = `hsl(var(--${item.color}))`;
  const deep = `color-mix(in srgb, ${hue} 72%, black 28%)`;
  const front = `linear-gradient(160deg, color-mix(in srgb, ${hue} 90%, white 6%), color-mix(in srgb, ${hue} 84%, black 16%))`;
  return (
    <motion.div
      className="relative"
      style={{ width: FOLDER_W, height: FOLDER_H }}
      animate={{ scale: isDropTarget ? 1.06 : 1 }}
      transition={{ type: "spring", stiffness: 480, damping: 26 }}
    >
      <FolderShell
        fill={deep}
        className={cn(
          "absolute inset-0 h-full w-full transition-[filter]",
          isDropTarget
            ? "drop-shadow-[0_4px_8px_rgb(40_32_24/0.3)]"
            : "drop-shadow-[0_2px_3px_rgb(40_32_24/0.2)]",
        )}
      />

      {/* The open tray: a backing panel above the folder with the contents in a
          grid. Springs up out of the folder mouth. */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="tray"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-[calc(100%-14px)] left-1/2 z-[8] w-max min-w-full -translate-x-1/2 rounded-2xl border border-black/10 bg-surface/95 p-2 shadow-soft backdrop-blur-md"
          >
            {members.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-ink-muted">
                Empty — drag things onto the folder.
              </p>
            ) : (
              <div className="grid max-w-[220px] grid-cols-4 gap-1.5">
                {members.map((m, i) => (
                  <motion.button
                    key={m.id}
                    type="button"
                    title="Take out"
                    initial={{ opacity: 0, y: 10, scale: 0.6 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 520, damping: 24, delay: i * 0.04 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEject?.(m.id);
                    }}
                    className="h-12 w-12 overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition-transform hover:-translate-y-0.5 active:scale-90"
                  >
                    <MemberChip boardId={boardId} item={m} />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contents peeking out of the mouth when closed. */}
      {!open &&
        members.slice(0, 5).map((m, i) => (
          <motion.span
            key={m.id}
            initial={false}
            animate={{ x: 12 + i * 15, y: 10, rotate: i % 2 ? 5 : -4 }}
            transition={{ type: "spring", stiffness: 460, damping: 26 }}
            style={{ zIndex: 1 }}
            className="pointer-events-none absolute left-0 top-0 h-10 w-10 overflow-hidden rounded-md border border-black/10 bg-white shadow-md"
          >
            <MemberChip boardId={boardId} item={m} />
          </motion.span>
        ))}

      {/* Front panel */}
      <div
        className="absolute inset-x-0 bottom-0 z-[2] flex flex-col justify-end rounded-b-[10px] rounded-t-[3px] px-3 pb-2"
        style={{ height: "58%", background: front }}
      >
        <div className="flex items-center gap-1.5">
          <EditableLabel
            value={item.label}
            fallback="Folder"
            selected={selected}
            onCommit={(label) => onCommit({ label })}
            className="min-w-0 truncate font-display text-sm font-bold tracking-tight text-white"
          />
          {open ? (
            <span
              onPointerDown={(e) => e.stopPropagation()}
              className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-black/25 text-white/90"
              aria-hidden
            >
              <X className="h-2.5 w-2.5" />
            </span>
          ) : (
            members.length > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/90">
                {members.length}
              </span>
            )
          )}
        </div>
      </div>

      {isDropTarget && (
        <span className="absolute -top-7 left-1/2 z-[9] w-max -translate-x-1/2 rounded-full bg-ink px-2.5 py-1 text-[10px] font-medium text-paper shadow-soft">
          Drop into folder
        </span>
      )}

      {selected && <ZoneColors current={item.color} onPick={(color) => onCommit({ color })} />}
    </motion.div>
  );
}

/** Tiny preview of an item tucked inside a folder. */
function MemberChip({ boardId, item }: { boardId: string; item: BoardItem }) {
  switch (item.kind) {
    case "photo":
      return item.file ? (
        <img src={boardPhotoUrl(boardId, item.file)} alt="" className="h-full w-full object-cover" />
      ) : null;
    case "note":
      return (
        <span className={cn("block h-full w-full p-1 text-left", NOTE_BG[item.color])}>
          <span className="line-clamp-3 text-[7px] leading-tight text-ink/80">{item.text || "Note"}</span>
        </span>
      );
    case "sticker":
      return <span className="flex h-full w-full items-center justify-center text-2xl">{item.emoji}</span>;
    case "text":
      return (
        <span className="flex h-full w-full items-center p-1">
          <span className="line-clamp-3 font-display text-[8px] font-bold leading-tight text-ink">
            {item.text || "Text"}
          </span>
        </span>
      );
    case "link":
      return (
        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-sky/10 p-1">
          <ExternalLink className="h-3 w-3 text-sky" />
          <span className="line-clamp-1 text-[7px] font-medium text-ink">{item.label || "Link"}</span>
        </span>
      );
    case "doodle":
      return (
        <span className="flex h-full w-full items-center justify-center p-1">
          <DoodleGlyph strokes={item.strokes} aspect={item.aspect} width={44} />
        </span>
      );
    default:
      return null;
  }
}

/** Color dots for a selected section or folder. */
function ZoneColors({ current, onPick }: { current: GroupColor; onPick: (c: GroupColor) => void }) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-full z-40 mt-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-rule/70 bg-surface p-1.5 shadow-soft"
    >
      {ZONE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`${c} color`}
          onClick={() => onPick(c)}
          className={cn(
            "h-4 w-4 rounded-full transition-transform active:scale-90",
            current === c && "ring-2 ring-ink/30 ring-offset-1 ring-offset-surface",
          )}
          style={{ backgroundColor: `hsl(var(--${c}))` }}
        />
      ))}
    </div>
  );
}

/** Swap a selected sticker's emoji from the palette. */
function StickerControls({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-full z-40 mt-3 grid w-44 -translate-x-1/2 grid-cols-8 gap-0.5 rounded-2xl border border-rule/70 bg-surface p-1.5 shadow-soft"
    >
      {STICKERS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-lg p-0.5 text-base transition-[background-color,transform] hover:bg-ink/[0.05] active:scale-90"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

const NEXT_FRAME: Record<PhotoFrame, PhotoFrame> = {
  plain: "polaroid",
  polaroid: "stamp",
  stamp: "plain",
};

/** Floating controls for a selected photo: tap the frame to cycle plain →
 * polaroid → stamp, and for a framed photo pick the crop aspect. Sits below
 * the photo so it clears the rotate handle above. */
function PhotoControls({
  item,
  onCommit,
}: {
  item: Extract<BoardItem, { kind: "photo" }>;
  onCommit: (partial: Partial<BoardItem>) => void;
}) {
  const framed = item.frame !== "plain";
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-full z-40 mt-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-rule/70 bg-surface p-1 shadow-soft"
    >
      <button
        type="button"
        onClick={() => onCommit({ frame: NEXT_FRAME[item.frame] })}
        className="rounded-full bg-zest/15 px-2.5 py-1 text-[11px] font-medium capitalize text-zest transition-colors"
      >
        {item.frame}
      </button>
      {framed && (
        <>
          <span className="h-4 w-px bg-rule/70" aria-hidden />
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onCommit({ aspect: a.value })}
              className={cn(
                "rounded-full px-2 py-1 text-[10px] font-medium tabular-nums transition-colors",
                Math.abs(item.aspect - a.value) < 0.02
                  ? "bg-ink text-paper"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {a.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function NoteBody({
  text,
  color,
  w,
  selected,
  onCommit,
}: {
  text: string;
  color: NoteColor;
  w: number;
  selected: boolean;
  onCommit: (text: string) => void;
}) {
  const [draft, setDraft] = useState(text);
  const [prevText, setPrevText] = useState(text);
  if (prevText !== text) {
    setPrevText(text);
    setDraft(text);
  }
  return (
    <div style={{ width: w }} className={cn("grain rounded-sm p-3 shadow-soft", NOTE_BG[color])}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== text && onCommit(draft)}
        onPointerDown={(e) => selected && e.stopPropagation()}
        placeholder="Write…"
        aria-label="Note"
        rows={3}
        className="w-full resize-none bg-transparent text-sm leading-snug text-ink outline-none placeholder:text-ink/30"
      />
    </div>
  );
}

function LinkBody({
  url,
  label,
  selected,
  onCommit,
}: {
  url: string;
  label: string;
  selected: boolean;
  onCommit: (partial: { url?: string; label?: string }) => void;
}) {
  const [editing, setEditing] = useState(!url);
  const [u, setU] = useState(url);
  const [l, setL] = useState(label);
  const [prev, setPrev] = useState({ url, label });
  if (prev.url !== url || prev.label !== label) {
    setPrev({ url, label });
    setU(url);
    setL(label);
  }

  // Editing form: fields stop propagation so typing/clicking doesn't drag.
  if (editing && selected) {
    return (
      <div
        className="grain w-56 space-y-1.5 rounded-xl border border-rule/70 bg-surface p-2.5 shadow-soft"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={l}
          onChange={(e) => setL(e.target.value)}
          placeholder="Label"
          className="w-full rounded-md border border-rule/60 bg-paper/60 px-2 py-1 text-sm text-ink outline-none"
        />
        <input
          value={u}
          onChange={(e) => setU(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-rule/60 bg-paper/60 px-2 py-1 text-xs text-ink outline-none"
        />
        <button
          type="button"
          onClick={() => {
            onCommit({ url: u.trim(), label: l.trim() || u.trim() || "Link" });
            setEditing(false);
          }}
          className="w-full rounded-md bg-zest px-2 py-1 text-xs font-semibold text-paper"
        >
          Save
        </button>
      </div>
    );
  }

  // Display box: NOT an anchor, and no pointer-swallowing — so it drags with
  // the item. Open/Edit live on their own buttons when selected.
  return (
    <div className="grain flex w-52 items-center gap-2 rounded-xl border border-rule/70 bg-surface px-3 py-2.5 shadow-soft">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky/15 text-sky">
        <ExternalLink className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{label || "Link"}</span>
        {url && <span className="block truncate text-[11px] text-ink-muted">{prettyUrl(url)}</span>}
      </span>
      {selected && (
        <span className="flex shrink-0 items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {url && (
            <a
              href={url.startsWith("http") ? url : `https://${url}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open link"
              className="rounded-md p-1 text-ink-muted transition-colors hover:text-sky"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit link"
            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Edit
          </button>
        </span>
      )}
    </div>
  );
}

/** Free-form text on the board — no card, just words you can place anywhere.
 * The corner handle scales the type itself; selected, a small tray offers
 * font + weight. */
function TextBody({
  item,
  w,
  size,
  selected,
  onCommit,
}: {
  item: Extract<BoardItem, { kind: "text" }>;
  w: number;
  size: number;
  selected: boolean;
  onCommit: (partial: Partial<BoardItem>) => void;
}) {
  const text = item.text;
  const font = item.font ?? TEXT_DEFAULTS.font;
  const weight = item.weight ?? TEXT_DEFAULTS.weight;
  const [draft, setDraft] = useState(text);
  const [prev, setPrev] = useState(text);
  if (prev !== text) {
    setPrev(text);
    setDraft(text);
  }
  return (
    <>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== text && onCommit({ text: draft })}
        onPointerDown={(e) => selected && e.stopPropagation()}
        placeholder="Text…"
        aria-label="Text"
        rows={Math.max(1, draft.split("\n").length)}
        style={{ width: w, fontSize: size, fontWeight: weight }}
        className={cn(
          "resize-none bg-transparent leading-tight text-ink outline-none placeholder:text-ink/30",
          TEXT_FONT_CLASS[font],
          selected ? "cursor-text" : "pointer-events-none",
        )}
      />
      {selected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-full z-40 mt-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-rule/70 bg-surface p-1 shadow-soft"
        >
          {(Object.keys(TEXT_FONT_CLASS) as TextFont[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-label={`${f} font`}
              onClick={() => onCommit({ font: f })}
              className={cn(
                "rounded-full px-2 py-1 text-xs leading-none transition-colors",
                TEXT_FONT_CLASS[f],
                font === f ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
              )}
            >
              Aa
            </button>
          ))}
          <span className="h-4 w-px bg-rule/70" aria-hidden />
          {TEXT_WEIGHTS.map((tw) => (
            <button
              key={tw.value}
              type="button"
              onClick={() => onCommit({ weight: tw.value })}
              style={{ fontWeight: tw.value }}
              className={cn(
                "rounded-full px-2 py-1 text-[11px] leading-none transition-colors",
                weight === tw.value ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
              )}
            >
              {tw.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function EditableLabel({
  value,
  fallback,
  selected,
  onCommit,
  className,
}: {
  value: string;
  fallback: string;
  selected: boolean;
  onCommit: (v: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(value);
  }
  if (!selected) return <span className={className}>{value || fallback}</span>;
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={`${fallback} label`}
      className={cn(className, "bg-surface outline-none")}
    />
  );
}

function prettyUrl(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host;
  } catch {
    return url;
  }
}
