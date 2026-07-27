/** One thing eaten, in your own words. `kind` discriminates the collection so
 * other sorts of entry can share it later; only food is written today. */
export interface JournalEntry {
  id: string;
  kind: "food";
  /** Free text — "two eggs and toast". Never parsed, by design. */
  body: string;
  /** When it was eaten, not when it was typed, so a late entry still lands on
   * the right day. */
  eaten_at: string;
}
