/** The slice of a task record the planner needs. Dates are PB UTC strings;
 * empty = "". The web app owns the full page model (notes, checklist,
 * resources, attachments) — untouched fields survive round-trips. */
export interface Task {
  id: string;
  title: string;
  description: string; // one-liner under the title in agenda rows
  due_date: string; // date-only semantics, stored at 00:00Z
  done_at: string;
  sort_order: number; // manual agenda order
  start_min: number; // minutes from local midnight; 0 = unscheduled
  dur_min: number; // timebox length in minutes
  project: string; // owning learning program record id, or ""
  gate: boolean; // a project milestone session
  created: string;
}

/** Fields this client may write. */
export type TaskPatch = Partial<
  Pick<Task, "title" | "description" | "due_date" | "done_at" | "sort_order" | "start_min" | "dur_min">
>;
