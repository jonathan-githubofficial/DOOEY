// The building blocks of a "page" — shared shapes with the web app, so
// records round-trip between clients.

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Resource {
  id: string;
  url: string;
  label: string;
  kind: "link" | "youtube";
}

/** A task and its whole page, as one record. Dates are PB UTC strings;
 * empty = "". */
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
  sort_order: number; // manual agenda order (float, midpoint inserts)
  start_min: number; // minutes from local midnight; 0 = unscheduled
  dur_min: number; // timebox length in minutes
  project: string; // owning learning program record id, or ""
  gate: boolean; // a project milestone session
  created: string;
}

/** Fields this client may write. */
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
    | "sort_order"
    | "start_min"
    | "dur_min"
  >
>;
