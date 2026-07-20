// The task page body (unit 4.2, ported from src-legacy/features/tasks/components/TaskDetail.tsx
// onto Lynx): a loader + the loaded layout (back stamp, checkable header with editable
// title/description + due date, the four structured sections, delete link).
//
// DROPPED from the DOM/framer original (recorded BROOM): the `motion.section` entrance -> a CSS
// enter transition (fade + rise, cubic-bezier overshoot) gated on useReducedMotion(); `lucide-react`
// ArrowLeft/Trash2 -> the L2 icon set; the inline `<Link to="/">` in Gone -> a `<text bindtap>`
// calling navigate. DEFERRED to unit 7.x (recorded): the BoardSection / useCreateBoard / `board`
// field wiring is OMITTED entirely (SPEC 8 - no disabled "coming soon" placeholder; 7.x
// re-inserts the board block and its `@/features/boards` import). DueDateButton is imported from
// its sibling module (4.3 owns the interactive version; a read-only stub lands with 4.2 per R4).
import { useNavigate } from "@tanstack/react-router";

import { ArrowLeft, Trash2 } from "@/components/icons/lucide";
import { Check } from "@/components/page/Check";
import { PageSections } from "@/components/page/PageSections";
import { EditableText } from "@/components/editable";
import { Panel, StampButton } from "@/components/surface";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/stores";
import type { Task, TaskPatch } from "../types";
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
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const patch = (p: TaskPatch) => update.mutate({ id: task.id, patch: p });
  const done = !!task.done_at;
  const urlFor = (name: string) => attachmentUrl(task.id, name);

  return (
    <view
      data-testid="task-detail"
      className={cn("relative space-y-4", !reduced && "animate-enter")}
    >
      <StampButton onClick={() => navigate({ to: "/" })} className="text-ink-muted" data-testid="task-back">
        <ArrowLeft className="h-4 w-4 text-ink-muted" />
        <text className="text-sm font-medium text-ink-muted">Planner</text>
      </StampButton>

      <Panel>
        <view className="flex items-start gap-3.5">
          <Check
            done={done}
            className="mt-1.5 h-7 w-7"
            label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
            onToggle={() => patch({ done_at: done ? "" : new Date().toISOString() })}
          />
          <view className="min-w-0 flex-1">
            <EditableText
              value={task.title}
              ariaLabel="task title"
              testId="task-title"
              onCommit={(title) => patch({ title })}
              className={cn(
                "w-full font-display text-3xl font-bold leading-tight tracking-tight text-ink",
                done && "text-ink-muted line-through",
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
            <view className="mt-2.5">
              <DueDateButton due={task.due_date} onChange={(due_date) => patch({ due_date })} />
            </view>
          </view>
        </view>
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

      <view className="pt-2">
        <view
          bindtap={() => {
            del.mutate(task.id);
            navigate({ to: "/" });
          }}
          accessibility-label="Delete this task"
          data-testid="task-delete"
          className="inline-flex items-center gap-2 active:scale-95"
        >
          <Trash2 className="h-3.5 w-3.5 text-ink-muted" />
          <text className="text-xs text-ink-muted">delete this task</text>
        </view>
      </view>
    </view>
  );
}

function Gone() {
  const navigate = useNavigate();
  return (
    <Panel className="text-center" data-testid="task-gone">
      <text className="block font-display text-2xl font-semibold tracking-tight text-ink">
        This task is gone.
      </text>
      <text className="mt-1 block text-sm text-ink-muted">Deleted, or never existed.</text>
      <view
        bindtap={() => navigate({ to: "/" })}
        accessibility-label="Back to the planner"
        className="mt-4 inline-flex items-center gap-2 active:scale-95"
      >
        <ArrowLeft className="h-4 w-4 text-ink" />
        <text className="text-sm text-ink">Back to the planner</text>
      </view>
    </Panel>
  );
}
