// Generic day-key helpers shared across features. Day keys are YYYY-MM-DD /
// YYYY-MM strings in the browser's local timezone (the planner's unit of "a
// day"), distinct from lib/format.ts which renders stored UTC instants.

/** Zero-pad to two digits: 3 → "03". */
export const pad2 = (n: number) => String(n).padStart(2, "0");

/** The month key ("YYYY-MM") after `month`, rolling the year at December. */
export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`;
}
