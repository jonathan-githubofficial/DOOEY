import { useParams, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/surface";
import { BoardCanvas, useBoard, useBoardsLive } from "@/features/boards";

export function Board() {
  const { id } = useParams({ from: "/board/$id" });
  useBoardsLive();
  const { data: board, isPending, error } = useBoard(id);
  const navigate = useNavigate();

  if (error) {
    return (
      <Panel className="mt-8 text-center">
        <p className="font-display text-2xl font-semibold tracking-tight text-ink">This board is gone.</p>
        <button
          onClick={() => navigate({ to: "/boards" })}
          className="mt-4 inline-flex items-center gap-2 text-sm text-ink underline-offset-4 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> All boards
        </button>
      </Panel>
    );
  }
  if (isPending || !board) return null;
  return <BoardCanvas board={board} />;
}
