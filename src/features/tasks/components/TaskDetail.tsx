import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel, StampButton } from "@/components/surface";
import { EditableText } from "@/components/editable";
import { Check } from "@/components/page/Check";
import { PageSections } from "@/components/page/PageSections";
import { BoardSection, useCreateBoard } from "@/features/boards";
import type { Task } from "../types";
import {
  attachmentUrl,
  useDeleteTask,
  useTask,
  useTasksLive,
  useUpdateAttachments,
  useUpdateTask,
} from "../api";
import { DueDateButton } from "./DueDateButton";

export function TaskDetail({ id }: { id: string }) {
  useTasksLive();
  const { data: task, isPending, error } = useTask(id);

  if (error) return <Gone />;
  if (isPending || !task) return null; // local PB answers in ms — a flash of skeleton would be noise

  return <TaskDetailLoaded task={task} />;
}

function TaskDetailLoaded({ task }: { task: Task }) {
  const update = useUpdateTask();
  const attachMut = useUpdateAttachments();
  const del = useDeleteTask();
  const createBoard = useCreateBoard();
  const navigate = useNavigate();

  const patch = (p: Parameters<typeof update.mutate>[0]["patch"]) =>
    update.mutate({ id: task.id, patch: p });
  const done = !!task.done_at;
  const urlFor = (name: string) => attachmentUrl(task.id, name);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
      className="relative space-y-4"
    >
      <StampButton onClick={() => navigate({ to: "/" })} className="text-ink-muted">
        <ArrowLeft className="h-4 w-4" /> Planner
      </StampButton>

      <Panel>
        <div className="flex items-start gap-3.5">
          <Check
            done={done}
            className="mt-1.5 h-7 w-7"
            label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
            onToggle={() => patch({ done_at: done ? "" : new Date().toISOString() })}
          />
          <div className="min-w-0 flex-1">
            <EditableText
              value={task.title}
              ariaLabel="task title"
              onCommit={(title) => patch({ title })}
              className={cn(
                "w-full font-display text-3xl font-bold leading-tight tracking-tight text-ink",
                done && "text-ink-muted line-through decoration-rule",
              )}
              inputClassName="font-display text-3xl font-bold leading-tight tracking-tight"
            />
            <EditableText
              value={task.description}
              ariaLabel="task description"
              placeholder="Add a description…"
              onCommit={(description) => patch({ description })}
              className="mt-1 w-full text-sm text-ink-muted"
              inputClassName="text-sm"
            />
            <div className="mt-2.5">
              <DueDateButton due={task.due_date} onChange={(due_date) => patch({ due_date })} />
            </div>
          </div>
        </div>
      </Panel>

      <PageSections
        notes={task.notes}
        checklist={task.checklist}
        resources={task.resources}
        onPatch={patch}
        attach={{
          files: task.attachments,
          busy: attachMut.isPending,
          urlFor,
          onAdd: (files) => attachMut.mutate({ id: task.id, add: files }),
          onRemove: (name) => attachMut.mutate({ id: task.id, remove: name }),
        }}
      />

      <BoardSection
        boardId={task.board}
        busy={createBoard.isPending}
        onAttach={() =>
          createBoard.mutate(task.title || "Board", {
            onSuccess: (rec) => patch({ board: rec.id }),
          })
        }
      />

      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            del.mutate(task.id);
            navigate({ to: "/" });
          }}
          className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-clay"
        >
          <Trash2 className="h-3.5 w-3.5" /> delete this task
        </button>
      </div>
    </motion.section>
  );
}

function Gone() {
  return (
    <Panel className="text-center">
      <p className="font-display text-2xl font-semibold tracking-tight text-ink">
        This task is gone.
      </p>
      <p className="mt-1 text-sm text-ink-muted">Deleted, or never existed.</p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-2 text-sm text-ink underline-offset-4 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the planner
      </Link>
    </Panel>
  );
}
