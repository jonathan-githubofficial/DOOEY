import type { Task } from "@/features/tasks/types";

const DAY = 86_400_000;

export function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

/** A project task's due day as a Date (local midnight), or null if undated. */
export function taskDate(t: Task): Date | null {
  if (!t.due_date) return null;
  const d = new Date(t.due_date);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** A gate marker on the runway timeline. */
export interface RunwayGate {
  key: string;
  label: string;
  dateObj: Date | null;
  done: boolean;
}

/** A pointer to the task a countdown/label refers to. */
export interface NextTask {
  id: string;
  title: string;
  topic: string;
  dateObj: Date | null;
  isGate: boolean;
}

export interface ProjectStat {
  total: number;
  done: number;
  pct: number;
  startDate: Date | null;
  endDate: Date | null;
  gates: RunwayGate[];
  /** Next unfinished task, earliest by due date (dated first, then order). */
  next: NextTask | null;
  /** Next unfinished gate. */
  nextGate: NextTask | null;
}

function toNext(t: Task): NextTask {
  return { id: t.id, title: t.title, topic: t.description, dateObj: taskDate(t), isGate: t.gate };
}

/** Roll a project's tasks up into the numbers the folder card + hero show. */
export function projectStat(tasks: Task[]): ProjectStat {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done_at).length;
  const times = tasks.map(taskDate).filter((d): d is Date => d != null).map((d) => d.getTime());
  const startDate = times.length ? new Date(Math.min(...times)) : null;
  const endDate = times.length ? new Date(Math.max(...times)) : null;

  // Chronological where dated; input order (due_date,sort) otherwise.
  const ordered = tasks
    .map((t, i) => ({ t, i, at: taskDate(t)?.getTime() }))
    .sort((a, b) => {
      if (a.at != null && b.at != null && a.at !== b.at) return a.at - b.at;
      if (a.at != null && b.at == null) return -1;
      if (a.at == null && b.at != null) return 1;
      return a.i - b.i;
    })
    .map((x) => x.t);

  const nextTask = ordered.find((t) => !t.done_at) ?? null;
  const nextGateTask = ordered.find((t) => !t.done_at && t.gate) ?? null;

  return {
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    startDate,
    endDate,
    gates: tasks
      .filter((t) => t.gate)
      .map((t) => ({ key: t.id, label: t.title, dateObj: taskDate(t), done: !!t.done_at })),
    next: nextTask ? toNext(nextTask) : null,
    nextGate: nextGateTask ? toNext(nextGateTask) : null,
  };
}

/** Human relative-day label: "today", "overdue 3d", "in 5d". */
export function relDay(date: Date | null): string {
  if (!date) return "";
  const rel = daysBetween(startOfToday(), date);
  if (rel === 0) return "today";
  if (rel === 1) return "tomorrow";
  if (rel < 0) return `overdue ${-rel}d`;
  return `in ${rel}d`;
}
