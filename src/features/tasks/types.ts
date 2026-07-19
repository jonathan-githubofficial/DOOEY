import type { Stroke } from "@/lib/doodle";
import type { ChecklistItem, DecorItem, Resource } from "@/components/page/types";

export type { ChecklistItem, DecorItem, Resource };

/** An outside row the planner interleaves with tasks (learning sessions). It
 * can optionally be timeboxed on the calendar, just like a task. */
export interface AgendaExternal {
  id: string;
  sort: number;
  done: boolean;
  gate?: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  accentClass?: string; // tailwind bg-* class for the category dot
  to: string;
  params: Record<string, string>;
  onToggle: () => void;
  onSort: (sort: number) => void;
  // Timeboxing (learning sessions): minutes from midnight + slot length, with
  // setters that persist back to the program's per-session layout.
  startMin?: number;
  durMin?: number;
  onSchedule?: (startMin: number) => void;
  onResize?: (durMin: number) => void;
  onUnschedule?: () => void;
}

/** A task and its whole page, as one record. Dates are PB UTC strings; empty = "". */
export interface Task {
  id: string;
  title: string;
  description: string; // one-liner under the title in agenda rows
  due_date: string; // date-only semantics, stored at 00:00Z
  done_at: string;
  notes: string;
  checklist: ChecklistItem[];
  resources: Resource[];
  attachments: string[]; // PB-stored filenames
  doodle: Stroke[]; // scrapbook pen strokes on this task's page
  decor: DecorItem[]; // scrapbook stickers + framed photos
  decor_photos: string[]; // PB-stored filenames backing photo decorations
  sort_order: number; // manual agenda order (float, midpoint inserts)
  start_min: number; // minutes from local midnight; 0 = unscheduled
  dur_min: number; // timebox length in minutes
  board: string; // linked mood board record id, or ""
  project: string; // owning learning program (project) record id, or ""
  gate: boolean; // a project milestone session
  session_key: string; // SCHEDULE.md line this was materialized from, or ""
  created: string;
}

/** Fields a client mutation may write. */
export type TaskPatch = Partial<
  Pick<
    Task,
    | "title"
    | "description"
    | "due_date"
    | "done_at"
    | "notes"
    | "checklist"
    | "resources"
    | "doodle"
    | "decor"
    | "sort_order"
    | "start_min"
    | "dur_min"
    | "board"
    | "project"
    | "gate"
  >
>;
