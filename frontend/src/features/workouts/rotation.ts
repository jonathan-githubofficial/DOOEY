import { focusOf, MUSCLE_HUE } from "./focus";
import { MUSCLE_GROUPS } from "./library";
import type { CardHue, Routine, Workout, WorkoutProgram } from "./types";

function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position;
}

/** Finished sessions, newest first. The query already sorts this way; sorting
 * here too keeps these functions honest about their own input. */
function finished(workouts: Workout[]): Workout[] {
  return workouts
    .filter((w) => w.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

/** Where a rotation starts when history can't say — the first routine of the
 * first program. */
function firstRoutine(routines: Routine[], programs: WorkoutProgram[]): Routine | null {
  for (const p of [...programs].sort(byPosition)) {
    const first = routines.filter((r) => r.program === p.id).sort(byPosition)[0];
    if (first) return first;
  }
  return [...routines].sort(byPosition)[0] ?? null;
}

/** The routine to train next: the one after your last session's, by position
 * within its program, wrapping at the end. Sessions whose routine has since
 * been deleted — and ad-hoc sessions, which carry no routine — are skipped, so
 * the rotation survives both. A one-routine program returns itself: repeating
 * it is the correct answer, not an edge case. */
export function nextUp(
  routines: Routine[],
  programs: WorkoutProgram[],
  workouts: Workout[],
): Routine | null {
  if (routines.length === 0) return null;
  const byId = new Map(routines.map((r) => [r.id, r]));

  for (const w of finished(workouts)) {
    const done = byId.get(w.routine);
    if (!done) continue;
    const siblings = routines.filter((r) => r.program === done.program).sort(byPosition);
    const i = siblings.findIndex((r) => r.id === done.id);
    return siblings[(i + 1) % siblings.length];
  }
  return firstRoutine(routines, programs);
}

/** When a routine was last finished — ISO, or null if never. */
export function lastDoneAt(routineId: string, workouts: Workout[]): string | null {
  let latest: string | null = null;
  for (const w of workouts) {
    if (!w.ended_at || w.routine !== routineId) continue;
    if (!latest || w.started_at > latest) latest = w.started_at;
  }
  return latest;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** How long since you last ran this — the hero's one line of history. */
export function sinceLabel(iso: string | null): string {
  if (!iso) return "not trained yet";
  const then = startOfDay(new Date(iso)).getTime();
  const today = startOfDay(new Date()).getTime();
  const days = Math.round((today - then) / 86_400_000);
  if (days <= 0) return "trained today";
  if (days === 1) return "trained yesterday";
  return `last done ${days} days ago`;
}

/** Monday of the week `d` falls in, at local midnight. */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export interface RhythmDay {
  date: Date;
  /** The focus accent of that day's session, or null if you rested. */
  hueKey: CardHue | null;
  isToday: boolean;
  /** The session logged that day, so a day is a way into what you did. */
  workoutId: string | null;
}

/** How far back the journey reaches. Half a year of Mondays is 182 cells,
 * which draws in one pass and still shows a season's worth of rhythm; a full
 * year would double the view count for a stretch nobody scrolls to. Anything
 * older is reported as clipped rather than silently dropped. */
const JOURNEY_WEEKS = 26;

/** And the fewest. One week of history would make "open it out" do nothing
 * visible, which reads as a broken control rather than as a short history.
 * Six empty rows say "you've just started" — which is true, and is the shape
 * the grid will keep. */
const JOURNEY_MIN = 6;

export interface Journey {
  /** Monday→Sunday rows, **oldest first** — the last row is this week. */
  weeks: RhythmDay[][];
  /** The day of your first logged session, or null if there isn't one. Not the
   * day the grid opens on: the grid is padded out to a readable size, and
   * claiming you started on a Monday you hadn't yet trained would be a lie. */
  first: Date | null;
  /** True when sessions exist above the first row. */
  clipped: boolean;
  /** Finished sessions in total, clipped or not. */
  sessions: number;
}

/** Whole weeks between two Mondays. The hour a DST change adds or removes is
 * three orders of magnitude short of a week, so rounding absorbs it. */
function weeksBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (7 * 86_400_000));
}

/** Your training as a calendar: one cell per day, tinted with what you trained
 * that day, from your first session to this Sunday.
 *
 * This is the week strip and the history view at once — the same seven columns,
 * more rows. A list of session cards can tell you what you did; only the grid
 * can show you that you have skipped legs three weeks running, or that August
 * was a write-off, because the shape of the gaps *is* the information.
 *
 * One session per day, the latest of that day. Two sessions on a Saturday is
 * rare enough that showing the second one's colour and losing the first is a
 * better trade than splitting the cell. */
export function journeyWeeks(workouts: Workout[]): Journey {
  const done = finished(workouts); // newest first
  const thisMonday = startOfWeek(new Date());
  const today = startOfDay(new Date()).getTime();

  // Oldest first into the map, so the latest session of a day wins the cell.
  const byDay = new Map<number, Workout>();
  for (let i = done.length - 1; i >= 0; i--) {
    byDay.set(startOfDay(new Date(done[i].started_at)).getTime(), done[i]);
  }

  const first = done.length ? startOfDay(new Date(done[done.length - 1].started_at)) : null;
  const span = first ? weeksBetween(startOfWeek(first), thisMonday) + 1 : 1;
  const rows = Math.min(Math.max(span, JOURNEY_MIN), JOURNEY_WEEKS);
  const from = new Date(
    thisMonday.getFullYear(),
    thisMonday.getMonth(),
    thisMonday.getDate() - (rows - 1) * 7,
  );

  const weeks = Array.from({ length: rows }, (_, wi) =>
    Array.from({ length: 7 }, (_, di): RhythmDay => {
      const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + wi * 7 + di);
      const session = byDay.get(date.getTime());
      return {
        date,
        isToday: date.getTime() === today,
        hueKey: session ? (focusOf(session.entries)?.hueKey ?? "zest") : null,
        workoutId: session?.id ?? null,
      };
    }),
  );

  return { weeks, first, clipped: span > rows, sessions: done.length };
}

export interface WeekMuscle {
  hue: CardHue;
  /** The muscle a session was for, rather than one it also used. */
  strong: boolean;
}

/** Every muscle trained this week, each mapped to the accent of the session
 * that hit it — what the figure in the week panel shades.
 *
 * `strong` separates what a session was *for* from what it also worked, so a
 * week of benching shows a solid chest and faintly-shaded shoulders and
 * triceps rather than claiming all three equally. */
export function weekTargets(workouts: Workout[]): Map<string, WeekMuscle> {
  const monday = startOfWeek(new Date()).getTime();
  const painted = new Map<string, WeekMuscle>();
  // Oldest first, so a muscle hit twice wears its most recent session's colour.
  for (const w of [...finished(workouts)].reverse()) {
    if (new Date(w.started_at).getTime() < monday) continue;
    const focus = focusOf(w.entries);
    if (!focus) continue;
    // A muscle worked hard in one session and incidentally in another keeps
    // the stronger claim, whichever came last.
    for (const t of focus.secondary) {
      if (!painted.get(t)?.strong) painted.set(t, { hue: MUSCLE_HUE[t] ?? focus.hueKey, strong: false });
    }
    for (const t of focus.targets) painted.set(t, { hue: MUSCLE_HUE[t] ?? focus.hueKey, strong: true });
  }
  return painted;
}

/** The muscles the week has neglected — the one thing a gym page can tell you
 * that you can't work out by looking at a list. Groups never trained sort
 * first; anything hit this week is out of the running. */
export function restedLongest(workouts: Workout[], count = 2): string[] {
  const lastHit = new Map<string, number>();
  for (const w of finished(workouts)) {
    const at = new Date(w.started_at).getTime();
    for (const t of focusOf(w.entries)?.targets ?? []) {
      if ((lastHit.get(t) ?? 0) < at) lastHit.set(t, at);
    }
  }

  const monday = startOfWeek(new Date()).getTime();
  return TRACKED
    .filter((key) => (lastHit.get(key) ?? 0) < monday)
    .sort((a, b) => (lastHit.get(a) ?? 0) - (lastHit.get(b) ?? 0))
    .slice(0, count)
    .map((key) => MUSCLE_GROUPS.find((g) => g.key === key)?.label ?? key);
}

/** The groups worth reporting as rested — the ones a person trains on purpose.
 * Cardio and the small stabilisers are left out; nobody plans a calf-free week
 * around them. */
const TRACKED = [
  "pectorals",
  "delts",
  "lats",
  "traps",
  "biceps",
  "triceps",
  "abs",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
];
