import { addDays, localDateOf, mondayOf, nextMonth } from "@/lib/dates";
import type { CardHue } from "@/features/workouts/types";
import type { Entry, Tracker } from "./types";

/** One day's square in the album. */
export interface AlbumDay {
  date: string;
  /** Day of the month, for the numeral in the corner. */
  day: number;
  /** Spilled in from the month either side, so the weeks come out whole. */
  outside: boolean;
  isToday: boolean;
  /** Later than today, so nothing could have happened yet: drawn as absent
   * rather than as missed, because a blank Thursday in the future is not a gap
   * in the record. */
  ahead: boolean;
  /** One mark per *tracker* stamped that day, not per stamp. Three meals is one
   * mark: the question the grid answers is which things you kept, and a day
   * that shouted three times about food would drown the day beside it. */
  hues: CardHue[];
  /** Every stamp that day, which is what the opened day counts. */
  count: number;
  /** The session trained that day, if there was one. */
  workoutId: string;
}

/** The days a month's grid covers, spill included — what to ask the server for
 * so no square in the picture is drawn from missing data. */
export function monthRange(month: string): { from: string; to: string } {
  const first = mondayOf(`${month}-01`);
  // Six whole weeks always covers a month, whichever day it opens on.
  return { from: first, to: addDays(first, 42) };
}

/** A month as rows of seven, Monday first.
 *
 * Monday first because the rest of the app already is — the week strip, the
 * gym's history grid, `mondayOf`. A calendar that disagreed with the planner
 * about where a week starts would be its own small lie.
 *
 * Pure, so the arithmetic is testable without a server: everything it needs
 * arrives as lists. */
export function monthGrid(input: {
  month: string;
  entries: Entry[];
  trackers: Tracker[];
  /** Only sessions that finished; a live one has not happened yet. */
  workoutDays: { date: string; id: string }[];
  today: string;
}): AlbumDay[][] {
  const { month, entries, trackers, workoutDays, today } = input;

  // A tracker's place in the user's arrangement, so a day's marks come out in
  // the same order everywhere and the grid reads as columns of colour.
  const rank = new Map(trackers.map((t, i) => [t.id, i]));
  const hueOf = new Map(trackers.map((t) => [t.id, t.hue]));

  const stamped = new Map<string, { trackers: Set<string>; count: number }>();
  for (const entry of entries) {
    const day = localDateOf(entry.at);
    const cell = stamped.get(day) ?? { trackers: new Set<string>(), count: 0 };
    cell.trackers.add(entry.tracker);
    cell.count += 1;
    stamped.set(day, cell);
  }

  const trained = new Map(workoutDays.map((w) => [w.date, w.id]));
  const first = mondayOf(`${month}-01`);
  const after = `${nextMonth(month)}-01`;

  const rows: AlbumDay[][] = [];
  for (let r = 0; r < 6; r++) {
    const row = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(first, r * 7 + i);
      const cell = stamped.get(date);
      const hues = [...(cell?.trackers ?? [])]
        .filter((id) => hueOf.has(id))
        .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
        .map((id) => hueOf.get(id)!);
      return {
        date,
        day: Number(date.slice(8)),
        outside: date < `${month}-01` || date >= after,
        isToday: date === today,
        ahead: date > today,
        hues,
        count: cell?.count ?? 0,
        workoutId: trained.get(date) ?? "",
      };
    });
    // A sixth row entirely in next month is a row of nothing: February on a
    // Monday needs five, and drawing the sixth would print a whole blank week.
    if (row.every((d) => d.outside)) break;
    rows.push(row);
  }
  return rows;
}

/** Consecutive days ending today, or ending yesterday.
 *
 * Yesterday counts because a streak that breaks at midnight would read as
 * broken every morning before breakfast, which is a lie about the run and a
 * mean one. Nothing today and nothing yesterday is genuinely over. */
export function streakOf(days: Iterable<string>, today: string): number {
  const set = days instanceof Set ? days : new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  let run = 0;
  while (set.has(cursor)) {
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return run;
}

/** The days a tracker was stamped on, from a flat list of entries. */
export function daysStamped(entries: Entry[], trackerId: string): Set<string> {
  const out = new Set<string>();
  for (const entry of entries) {
    if (entry.tracker === trackerId) out.add(localDateOf(entry.at));
  }
  return out;
}
