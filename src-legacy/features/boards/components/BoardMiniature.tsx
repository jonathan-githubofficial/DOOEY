import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { FolderShell } from "@/components/icons/folder-shell";
import { strokePath } from "@/lib/doodle";
import { boardPhotoUrl } from "../api";
import {
  DEFAULT_W,
  FOLDER_H,
  FOLDER_W,
  TEXT_DEFAULTS,
  TEXT_FONT_CLASS,
  type BoardItem,
  type Moodboard,
} from "../types";
import { CANVAS_H, CANVAS_W } from "./BoardCanvas";
import { DoodleGlyph } from "./DoodleGlyph";

const NOTE_BG: Record<string, string> = {
  honey: "bg-honey/25",
  sky: "bg-sky/20",
  leaf: "bg-leaf/20",
  clay: "bg-clay/20",
  zest: "bg-zest/20",
};
const ZONE_BORDER: Record<string, string> = {
  sky: "border-sky/50",
  leaf: "border-leaf/50",
  zest: "border-zest/50",
  clay: "border-clay/50",
};
const ZONE_TINT: Record<string, string> = {
  sky: "bg-sky/[0.07]",
  leaf: "bg-leaf/[0.07]",
  zest: "bg-zest/[0.07]",
  clay: "bg-clay/[0.07]",
};

/** A read-only, scaled-down render of the actual board — items at their real
 * positions — for embedding in a page. It's inert; the caller wraps it in a
 * link to expand into the full canvas. */
export function BoardMiniature({ board }: { board: Moodboard }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CANVAS_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-2xl border border-rule/60 bg-paper/60"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
      >
        {board.doodle.length > 0 && (
          <svg
            aria-hidden
            width={CANVAS_W}
            height={CANVAS_H}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="absolute inset-0"
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
          </svg>
        )}
        {board.items
          .filter((i) => !i.parent)
          .map((item) => (
            <MiniItem
              key={item.id}
              item={item}
              boardId={board.id}
              memberCount={
                item.kind === "group"
                  ? board.items.filter((m) => m.parent === item.id).length
                  : 0
              }
            />
          ))}
      </div>
    </div>
  );
}

function MiniItem({
  item,
  boardId,
  memberCount,
}: {
  item: BoardItem;
  boardId: string;
  memberCount: number;
}) {
  const rot = item.rot ?? 0;
  return (
    <div
      className="absolute left-0 top-0"
      style={{ transform: `translate(${item.x}px, ${item.y}px) rotate(${rot}deg)` }}
    >
      <MiniContent item={item} boardId={boardId} memberCount={memberCount} />
    </div>
  );
}

function MiniContent({
  item,
  boardId,
  memberCount,
}: {
  item: BoardItem;
  boardId: string;
  memberCount: number;
}) {
  switch (item.kind) {
    case "section":
      return (
        <div
          style={{ width: item.w, height: item.h }}
          className={cn(
            "overflow-hidden rounded-2xl border-2 border-dashed",
            ZONE_BORDER[item.color],
            ZONE_TINT[item.color],
          )}
        >
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5"
            style={{ background: `color-mix(in srgb, hsl(var(--${item.color})) 22%, transparent)` }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-[3px]"
              style={{ backgroundColor: `hsl(var(--${item.color}))` }}
            />
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {item.label || "Section"}
            </span>
          </div>
        </div>
      );
    case "group": {
      const hue = `hsl(var(--${item.color}))`;
      return (
        <div className="relative" style={{ width: FOLDER_W, height: FOLDER_H }}>
          <FolderShell fill={`color-mix(in srgb, ${hue} 72%, black 28%)`} />
          <span
            className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 rounded-b-[10px] rounded-t-[3px] px-3 pb-2"
            style={{
              height: "58%",
              background: `linear-gradient(160deg, color-mix(in srgb, ${hue} 90%, white 6%), color-mix(in srgb, ${hue} 84%, black 16%))`,
              alignItems: "flex-end",
            }}
          >
            <span className="truncate font-display text-sm font-bold tracking-tight text-white">
              {item.label || "Folder"}
            </span>
            {memberCount > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/90">
                {memberCount}
              </span>
            )}
          </span>
        </div>
      );
    }
    case "note":
      return (
        <div
          style={{ width: item.w ?? DEFAULT_W.note }}
          className={cn("rounded-sm p-3 shadow-soft", NOTE_BG[item.color] ?? "bg-honey/25")}
        >
          <p className="whitespace-pre-wrap text-sm leading-snug text-ink">{item.text}</p>
        </div>
      );
    case "text":
      return (
        <p
          style={{
            width: item.w,
            fontSize: item.size ?? TEXT_DEFAULTS.size,
            fontWeight: item.weight ?? TEXT_DEFAULTS.weight,
          }}
          className={cn(
            "whitespace-pre-wrap leading-tight text-ink",
            TEXT_FONT_CLASS[item.font ?? TEXT_DEFAULTS.font],
          )}
        >
          {item.text}
        </p>
      );
    case "doodle":
      return <DoodleGlyph strokes={item.strokes} aspect={item.aspect} width={item.w} />;
    case "sticker":
      return (
        <span style={{ fontSize: item.w ?? DEFAULT_W.sticker }} className="block leading-none">
          {item.emoji}
        </span>
      );
    case "photo":
      return (
        <span
          style={{ width: item.w }}
          className={cn(
            "block",
            item.frame === "polaroid" && "border border-black/10 bg-white p-2 pb-6 shadow-soft",
            item.frame === "stamp" && "stamp-edge bg-white p-1.5 shadow-soft",
            item.frame === "plain" && "overflow-hidden rounded-lg shadow-soft",
          )}
        >
          {item.file && (
            <img
              src={boardPhotoUrl(boardId, item.file)}
              alt=""
              style={{ aspectRatio: item.aspect }}
              className={cn("w-full", item.frame === "plain" ? "object-contain" : "object-cover")}
            />
          )}
        </span>
      );
    case "link":
      return (
        <div className="flex w-52 items-center gap-2 rounded-xl border border-rule/70 bg-surface px-3 py-2.5 shadow-soft">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{item.label || "Link"}</span>
          </span>
        </div>
      );
  }
}
