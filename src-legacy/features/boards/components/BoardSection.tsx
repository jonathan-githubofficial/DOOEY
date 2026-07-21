import { Link } from "@tanstack/react-router";
import { Maximize2, Plus } from "lucide-react";
import { Eyebrow, Panel } from "@/components/surface";
import { useBoard } from "../api";
import { BoardMiniature } from "./BoardMiniature";

/** A page's board: create one, or a preview that opens the full canvas. This
 * is the richer replacement for the old scrapbook layer. */
export function BoardSection({
  boardId,
  onAttach,
  busy,
}: {
  boardId: string;
  onAttach: () => void;
  busy?: boolean;
}) {
  if (!boardId) {
    return (
      <Panel className="p-5 md:p-6">
        <Eyebrow>board</Eyebrow>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          A free-form space for this task — notes, links, photos, stickers and doodles, arranged
          however you like.
        </p>
        <button
          type="button"
          onClick={onAttach}
          disabled={busy}
          className="mt-4 flex items-center gap-2 rounded-full bg-zest px-4 py-2 text-sm font-semibold text-paper shadow-soft transition-transform active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> {busy ? "…" : "Add a board"}
        </button>
      </Panel>
    );
  }
  return <LinkedBoard id={boardId} />;
}

function LinkedBoard({ id }: { id: string }) {
  const { data: board } = useBoard(id);
  if (!board) return null;
  return (
    <Panel className="p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow>board</Eyebrow>
        <span className="truncate font-display text-sm font-bold tracking-tight text-ink">
          {board.title}
        </span>
      </div>
      {/* The board itself, live but read-only — tap to open the full canvas. */}
      <Link
        to="/board/$id"
        params={{ id }}
        className="group relative mt-2 block overflow-hidden rounded-2xl"
      >
        <BoardMiniature board={board} />
        <span className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors group-hover:bg-ink/10">
          <span className="flex items-center gap-1.5 rounded-full border border-rule/70 bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
            <Maximize2 className="h-3.5 w-3.5" /> Open board
          </span>
        </span>
      </Link>
    </Panel>
  );
}
