/** What the parse endpoint returns: the complete intended state for the
 * transcript so far. Declarative on purpose — when the speaker backtracks
 * ("...actually not the beach, the gym"), the next draft simply doesn't
 * contain the beach. No edit protocol to get wrong. */

export interface TaskDraft {
  kind: "task";
  title: string;
  /** YYYY-MM-DD, only when the speaker anchored one. */
  date: string | null;
  /** HH:MM local, only when a clock time or clear moment was spoken. */
  time: string | null;
  duration_min: number | null;
  checklist: string[];
  note: string | null;
}

export interface EntryDraft {
  kind: "entry";
  /** Which tracker this belongs under, by slug. The parse route is told the
   * speaker's own trackers and will not invent one, so an unknown slug here
   * means the tracker was deleted mid-ramble and the draft is dropped. */
  tracker: string;
  /** The speaker's own words, never itemized. Empty is legitimate: "seventy
   * eight" against a weight tracker is a whole entry. */
  body: string;
  /** What was measured, when the tracker measures anything. Minutes for a
   * duration. Null for words and ticks. */
  value: number | null;
  /** YYYY-MM-DD; null falls back to today at commit time. */
  date: string | null;
  /** HH:MM local, if a time was spoken or is inferable. */
  time: string | null;
}

export type DraftEntity = TaskDraft | EntryDraft;

export interface ParseResponse {
  rev: number;
  entities: DraftEntity[];
}
