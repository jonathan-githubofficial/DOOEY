import { localDate } from "./api";

/** The YYYY-MM-DD part of a PB date string (due dates are date-only by contract). */
export function dateOnly(pbDate: string): string {
  return pbDate.slice(0, 10);
}

/** A date-input value (YYYY-MM-DD) → PB storage form (00:00Z, date-only meaning). */
export function toPbDate(dateInput: string): string {
  return `${dateInput} 00:00:00.000Z`;
}

/** Local noon dodges timezone edge-shifts when converting a date-only string. */
export function toLocalNoon(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

export function addDays(date: string, n: number): string {
  const d = toLocalNoon(date);
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  const dow = toLocalNoon(date).getDay(); // 0=Sun..6=Sat
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** The seven days (Mon–Sun) of the week containing `date`. */
export function weekOf(date: string): string[] {
  const monday = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Sheet heading for a day: "Today" / "Tomorrow" / "Yesterday" / "Friday" —
 * the calendar date itself rides along as a stamp, so the name never repeats it. */
export function dayTitle(date: string): string {
  const today = localDate();
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  return toLocalNoon(date).toLocaleDateString("en", { weekday: "long" });
}

export interface DueInfo {
  text: string;
  tone: "overdue" | "today" | "future";
}

export function dueInfo(pbDue: string): DueInfo {
  const due = dateOnly(pbDue);
  const today = localDate();
  if (due === today) return { text: "today", tone: "today" };
  const pretty = toLocalNoon(due).toLocaleDateString("en", { month: "short", day: "numeric" });
  if (due < today) return { text: pretty, tone: "overdue" };
  return { text: pretty, tone: "future" };
}
