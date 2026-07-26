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
  /** The focus accent of that day's first session, or null if you rested. */
  hueKey: CardHue | null;
  isToday: boolean;
}

/** Monday→Sunday of the current week, each day carrying the colour of what you
 * trained. Days you rested stay null. */
export function weekRhythm(workouts: Workout[]): RhythmDay[] {
  const monday = startOfWeek(new Date());
  const done = finished(workouts);
  const today = startOfDay(new Date()).getTime();

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const session = done.find((w) => {
      const t = new Date(w.started_at).getTime();
      return t >= date.getTime() && t < next;
    });
    return {
      date,
      isToday: date.getTime() === today,
      hueKey: session ? (focusOf(session.entries)?.hueKey ?? "zest") : null,
    };
  });
}

/** Every muscle trained this week, each mapped to the accent of the session
 * that hit it — what the figure in the week panel shades. */
export function weekTargets(workouts: Workout[]): Map<string, CardHue> {
  const monday = startOfWeek(new Date()).getTime();
  const painted = new Map<string, CardHue>();
  // Oldest first, so a muscle hit twice wears its most recent session's colour.
  for (const w of [...finished(workouts)].reverse()) {
    if (new Date(w.started_at).getTime() < monday) continue;
    const focus = focusOf(w.entries);
    if (!focus) continue;
    for (const t of focus.targets) painted.set(t, MUSCLE_HUE[t] ?? focus.hueKey);
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
