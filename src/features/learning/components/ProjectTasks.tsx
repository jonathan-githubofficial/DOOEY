import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Panel, Eyebrow, Stamp } from "@/components/surface";
import { Check } from "@/components/page/Check";
import { useCreateTask, useProjectTasks, useUpdateTask, type Task } from "@/features/tasks";
import { categoryFor } from "../categories";
import { projectStat, relDay, taskDate } from "../metrics";
import type { GeneratedProgram } from "../types";

/** A project's work as real tasks: a progress meter, the tasks (tickable, each
 * opening its own page), and a quick-add. Ticking one is the same as ticking a
 * task anywhere — it flows straight into Today and the calendar. */
export function ProjectTasks({ program }: { program: GeneratedProgram }) {
  const { data: tasks } = useProjectTasks(program.pbId);
  const create = useCreateTask();
  const update = useUpdateTask();
  const cat = categoryFor(program.goal);
  const [title, setTitle] = useState("");

  if (!program.pbId) {
    return (
      <Panel>
        <Eyebrow>tasks</Eyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to sync — this project&apos;s tasks live in your account.
        </p>
      </Panel>
    );
  }

  const list = tasks ?? [];
  const m = projectStat(list);
  const complete = m.total > 0 && m.done === m.total;
  const open = list.filter((t) => !t.done_at);
  const done = list.filter((t) => t.done_at);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    create.mutate({ title: t, project: program.pbId });
    setTitle("");
  };

  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>tasks</Eyebrow>
        {m.total > 0 && (
          <span className="font-medium tabular-nums text-ink-muted">
            <span className={cn(complete ? "text-leaf" : "text-ink")}>{m.done}</span>
            <span className="px-1">/</span>
            {m.total}
          </span>
        )}
      </div>
      {m.total > 0 && (
        <div className="inset-well mt-3 h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className={cn("h-full rounded-full transition-all duration-500", complete ? "bg-leaf" : cat.accent)}
            style={{ width: `${m.pct}%` }}
          />
        </div>
      )}

      <ul className="mt-4">
        <AnimatePresence initial={false}>
          {open.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={() => markDone(update, task, true)} />
          ))}
        </AnimatePresence>
      </ul>

      {/* Quick-add */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-2 flex items-center gap-2 border-t border-rule/50 pt-3"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-muted">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task to this project…"
          aria-label="New project task"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/60"
        />
        {title.trim() && (
          <button
            type="submit"
            className="shrink-0 rounded-full bg-zest px-3 py-1 text-xs font-semibold text-paper shadow-soft"
          >
            Add
          </button>
        )}
      </form>

      {done.length > 0 && (
        <div className="mt-5">
          <Eyebrow>done</Eyebrow>
          <ul className="mt-1">
            <AnimatePresence initial={false}>
              {done.map((task) => (
                <DoneRow key={task.id} task={task} onToggle={() => markDone(update, task, false)} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {m.total === 0 && (
        <p className="mt-1 text-sm text-ink-muted">No tasks yet — add the first one above.</p>
      )}
    </Panel>
  );
}

function markDone(update: ReturnType<typeof useUpdateTask>, task: Task, done: boolean) {
  update.mutate({ id: task.id, patch: { done_at: done ? new Date().toISOString() : "" } });
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const date = taskDate(task);
  const overdue = date != null && relDay(date).startsWith("overdue");
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "group -mx-2 flex list-none items-start gap-3.5 rounded-xl border-t border-rule/50 px-2 py-2.5 transition-colors first:border-t-0 hover:bg-ink/[0.03]",
        task.gate && "bg-zest/[0.05]",
      )}
    >
      <Check
        done={false}
        gate={task.gate}
        className="mt-0.5 h-[22px] w-[22px]"
        onToggle={onToggle}
        label={`Complete ${task.title}`}
      />
      <Link to="/task/$id" params={{ id: task.id }} className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-medium text-ink">{task.title}</span>
            {task.gate && (
              <Stamp className="text-zest border-zest/45" rotate={-4}>
                Gate
              </Stamp>
            )}
          </span>
          {date && (
            <span className={cn("text-xs tabular-nums", overdue ? "text-clay" : "text-ink-muted")}>
              {relDay(date)}
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-0.5 truncate text-sm text-ink-muted">{task.description}</p>
        )}
      </Link>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted/50 transition-opacity group-hover:text-ink-muted" />
    </motion.li>
  );
}

function DoneRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="-mx-2 flex items-center gap-3.5 rounded-xl border-t border-rule/50 px-2 py-2.5 first:border-t-0"
    >
      <Check
        done
        className="h-[22px] w-[22px]"
        onToggle={onToggle}
        label={`Reopen ${task.title}`}
      />
      <Link
        to="/task/$id"
        params={{ id: task.id }}
        className="min-w-0 flex-1 truncate text-[15px] text-ink-muted line-through decoration-rule"
      >
        {task.title}
      </Link>
    </motion.li>
  );
}
