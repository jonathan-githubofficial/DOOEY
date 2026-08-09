import type { ChecklistItem } from "@/features/tasks/types";
import { pad2, toLocalNoon, toPbDate } from "@/lib/dates";
import type { EntryDraft, TaskDraft } from "./types";

/** "HH:MM" → minutes from local midnight. 0 doubles as "unscheduled" by the
 * planner's contract, which is fine: it never schedules at midnight. */
export function minutesOf(time: string | null): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export interface TaskCreateParams {
  title: string;
  notes?: string;
  due_date?: string;
  start_min?: number;
  dur_min?: number;
  checklist?: ChecklistItem[];
}

/** A drafted task → what `useCreateTask` takes. `now` is a parameter so the
 * mapping stays a pure function under test. */
export function taskParamsFrom(draft: TaskDraft, now: Date): TaskCreateParams {
  // A time with no date means today: "at seven" is this evening, not someday.
  const date = draft.date ?? (draft.time ? dayKeyOf(now) : null);
  return {
    title: draft.title,
    notes: draft.note ?? undefined,
    due_date: date ? toPbDate(date) : undefined,
    start_min: draft.time ? minutesOf(draft.time) : undefined,
    dur_min: draft.time ? (draft.duration_min ?? 60) : undefined,
    checklist: draft.checklist.map((label, i) => ({
      id: `${now.getTime() + i}`,
      label,
      done: false,
    })),
  };
}

/** When a drafted entry actually happened, as a real instant. */
export function entryAtFrom(draft: EntryDraft, now: Date): Date {
  const date = draft.date ?? dayKeyOf(now);
  if (draft.time) return new Date(`${date}T${draft.time}:00`);
  if (date === dayKeyOf(now)) return now;
  // A past day with no time spoken: noon keeps it on that day in any timezone.
  return toLocalNoon(date);
}
