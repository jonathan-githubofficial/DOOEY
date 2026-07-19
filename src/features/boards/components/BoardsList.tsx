import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/surface";
import { boardPhotoUrl, useBoards, useBoardsLive, useCreateBoard, useDeleteBoard } from "../api";
import type { BoardItem, Moodboard } from "../types";
import { DoodleGlyph } from "./DoodleGlyph";

const NOTE_TINT: Record<string, string> = {
  honey: "bg-honey/50",
  sky: "bg-sky/50",
  leaf: "bg-leaf/50",
  clay: "bg-clay/50",
  zest: "bg-zest/50",
};

/** The wall of boards: a folder-ish card per board, plus a create tile. */
export function BoardsList() {
  useBoardsLive();
  const { data: boards, isPending } = useBoards();
  const create = useCreateBoard();
  const navigate = useNavigate();

  const newBoard = () =>
    create.mutate("Untitled board", {
      onSuccess: (r) => navigate({ to: "/board/$id", params: { id: r.id } }),
    });

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <motion.button
        type="button"
        onClick={newBoard}
        disabled={create.isPending}
        whileTap={{ scale: 0.97 }}
        className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-rule/80 text-ink-muted transition-colors hover:border-ink hover:text-ink"
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">New board</span>
      </motion.button>

      {boards?.map((b) => <BoardCard key={b.id} board={b} />)}

      {!isPending && boards?.length === 0 && (
        <p className="col-span-full mt-2 text-sm text-ink-muted">
          No boards yet — start one to collect ideas, images and links.
        </p>
      )}
    </div>
  );
}

function BoardCard({ board }: { board: Moodboard }) {
  const tiles = pickFanTiles(board.items);
  const edited = new Date(board.updated).toLocaleDateString("en", { month: "short", day: "numeric" });
  return (
    <Link to="/board/$id" params={{ id: board.id }}>
      <motion.div whileTap={{ scale: 0.99 }}>
        <Panel className="relative aspect-[16/9] overflow-hidden p-4">
          <p className="max-w-[75%] truncate font-display text-lg font-bold leading-tight tracking-tight text-ink">
            {board.title}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">Edited {edited}</p>

          <BoardMenu board={board} />

          {/* A fan of the board's pieces, spilling up from the bottom edge. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[42%]">
            {tiles.length === 0 ? (
              <span className="absolute inset-x-0 bottom-5 text-center text-3xl text-ink-muted/20">✦</span>
            ) : (
              tiles.map((t, i) => (
                <FanTile key={t.id} item={t} boardId={board.id} index={i} count={tiles.length} />
              ))
            )}
          </div>
        </Panel>
      </motion.div>
    </Link>
  );
}

/** The ⋯ button + its little menu (delete, for now). Intercepts the click so
 * it never triggers the card's navigation. */
function BoardMenu({ board }: { board: Moodboard }) {
  const del = useDeleteBoard();
  const [open, setOpen] = useState(false);
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <span className="absolute right-3 top-3 z-20" onClick={stop}>
      <button
        type="button"
        aria-label="Board options"
        onClick={(e) => {
          stop(e);
          setOpen((o) => !o);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            {/* click-away scrim */}
            <span
              className="fixed inset-0 z-10"
              onClick={(e) => {
                stop(e);
                setOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-rule/70 bg-surface p-1 shadow-soft"
            >
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setOpen(false);
                  del.mutate(board.id);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink transition-colors hover:bg-clay/10 hover:text-clay"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete board
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Up to three pieces for the card's fan — photos first, then the rest.
 * Items tucked inside folders and section frames don't make the cut. */
function pickFanTiles(items: BoardItem[]): BoardItem[] {
  const order = { photo: 0, note: 1, doodle: 2, group: 3, sticker: 4, text: 5, link: 6, section: 7 };
  return [...items]
    .filter((i) => !i.parent && i.kind !== "section")
    .sort((a, b) => order[a.kind] - order[b.kind])
    .slice(0, 3);
}

/** One card in the fan: rotated, overlapping, bleeding off the bottom. */
function FanTile({
  item,
  boardId,
  index,
  count,
}: {
  item: BoardItem;
  boardId: string;
  index: number;
  count: number;
}) {
  const spread = index - (count - 1) / 2;
  return (
    <div
      className="absolute w-[38%] overflow-hidden rounded-xl border border-black/5 bg-surface shadow-md"
      style={{
        left: `${28 + spread * 22}%`,
        bottom: `${-10 - Math.abs(spread) * 2}%`,
        rotate: `${spread * 10}deg`,
        zIndex: index,
        aspectRatio: item.kind === "sticker" ? "1" : "4 / 3",
      }}
    >
      <FanContent item={item} boardId={boardId} />
    </div>
  );
}

function FanContent({ item, boardId }: { item: BoardItem; boardId: string }) {
  switch (item.kind) {
    case "photo":
      return <img src={boardPhotoUrl(boardId, item.file)} alt="" className="h-full w-full object-cover" />;
    case "note":
      return (
        <div className={cn("h-full w-full p-2", NOTE_TINT[item.color] ?? "bg-honey/50")}>
          <p className="line-clamp-3 text-[9px] leading-tight text-ink/80">{item.text || "Note"}</p>
        </div>
      );
    case "group":
      return (
        <div className="flex h-full w-full items-center justify-center bg-surface">
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {item.label || "Folder"}
          </span>
        </div>
      );
    case "text":
      return (
        <div className="flex h-full w-full items-center p-2">
          <p className="line-clamp-3 font-display text-[11px] font-bold leading-tight text-ink">
            {item.text || "Text"}
          </p>
        </div>
      );
    case "sticker":
      return <div className="flex h-full w-full items-center justify-center text-3xl">{item.emoji}</div>;
    case "doodle":
      return (
        <div className="flex h-full w-full items-center justify-center bg-surface p-1.5">
          <DoodleGlyph strokes={item.strokes} aspect={item.aspect} width={item.aspect < 1 ? 48 * item.aspect : 48} />
        </div>
      );
    case "link":
      return (
        <div className="flex h-full w-full items-center bg-sky/10 p-2">
          <p className="line-clamp-2 text-[9px] font-medium text-ink">{item.label || "Link"}</p>
        </div>
      );
  }
}

