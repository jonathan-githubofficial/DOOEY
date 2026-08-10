import { addDays, dateOnly, localDateOf } from "@/lib/dates";
import type { Task } from "@/features/tasks/types";
import type { Entry, Shape, Tracker } from "@/features/trackers/types";
import { focusOf } from "@/features/workouts/focus";
import { workoutElapsed, workoutSetsDone, workoutVolume } from "@/features/workouts/types";
import type { Workout } from "@/features/workouts/types";

/** What a stretch of days actually contained, counted rather than described.
 *
 * **Nothing in this file talks to a model, and that is the point.** Asking a
 * language model to add up forty rows is asking it to be bad at something a
 * loop is perfect at, and a summary whose numbers are quietly wrong is worse
 * than no summary: it reads exactly as confidently as a correct one. So the
 * arithmetic happens here, in a pure function under test, and anything that
 * later wants to *narrate* a week gets handed finished numbers and is left
 * with nothing to do but choose the words.
 *
 * It is deliberately descriptive. It reports what happened and how that
 * compares with the stretch before; it draws no conclusions about why. One
 * person logging for a year is fifty-two data points, and a claim like "you
 * sleep worse when you train late" pulled from six of them is a guess wearing
 * the clothes of a finding.
 */

/** How many readings each side needs before two averages may be compared.
 *
 * Counts are exempt: "three sessions, down from four" is a complete tally of
 * everything that happened, not a sample of it. An *average* of two nights
 * against an average of seven is a different thing entirely, and the honest
 * answer to "is my sleep down?" on that evidence is silence. */
export const MIN_FOR_MEAN = 3;

/** How many finished titles and how many logged phrases are worth carrying:
 * enough for a narrator to quote something real, not so many that the digest
 * becomes the raw data again. */
const MAX_TITLES = 8;
const MAX_WORDS = 5;

export interface DigestInput {
  /** Window start, YYYY-MM-DD, inclusive. */
  from: string;
  /** Window end, YYYY-MM-DD, exclusive. */
  to: string;
  /** Records covering this window **and the equally long one before it** — the
   * comparison is computed here rather than asked of the caller, so there is
   * one definition of "last week" instead of one per call site. */
  tasks: Task[];
  entries: Entry[];
  trackers: Tracker[];
  workouts: Workout[];
}

export interface TaskDigest {
  /** Finished inside the window, whenever they were due. */
  done: number;
  created: number;
  /** Due inside the window and still not done. */
  unfinished: number;
  /** What was finished, most recent first. */
  finished: string[];
  /** Completions per tag, busiest first. */
  byTag: { tag: string; done: number }[];
  /** Against the window before. A count is never a sample, so this is always
   * safe to state. */
  doneDelta: number;
}

export interface TrackerDigest {
  slug: string;
  name: string;
  shape: Shape;
  unit: string;
  /** The top of the scale this tracker was defined with, so "4" can be read
   * back as "4 of 5" without anyone downstream going to find the tracker
   * again. 0 for every other shape. Not to be confused with `max` below,
   * which is the largest reading actually taken. */
  scaleMax: number;
  /** How many times it was logged, and on how many separate days. Three
   * readings on one day is not the same week as three readings on three. */
  count: number;
  daysLogged: number;
  /** Measuring shapes only; null for words and ticks. */
  mean: number | null;
  min: number | null;
  max: number | null;
  total: number | null;
  /** The most recent reading in the window. */
  latest: number | null;
  /** Change in the average against the window before, or **null when either
   * side has fewer than `MIN_FOR_MEAN` readings**. Null means "not enough to
   * say", and whatever renders this must say nothing rather than round it to
   * zero. */
  meanDelta: number | null;
  countDelta: number;
  /** The logger's own words, most recent first. Never summarized here. */
  words: string[];
}

export interface WorkoutDigest {
  count: number;
  /** Time actually trained, pauses removed. */
  minutes: number;
  /** Σ weight × reps over completed weighted sets. */
  volume: number;
  sets: number;
  /** Session names, most recent first. */
  titles: string[];
  /** What was trained, most sessions first: [{ label: "Chest", count: 2 }]. */
  focus: { label: string; count: number }[];
  countDelta: number;
  volumeDelta: number;
}

export interface Digest {
  from: string;
  /** Exclusive. */
  to: string;
  days: number;
  /** The stretch this one is compared against. */
  previous: { from: string; to: string };
  tasks: TaskDigest;
  /** Every live tracker touched in either window, busiest first. A tracker
   * nobody logged in either is not news. */
  trackers: TrackerDigest[];
  workouts: WorkoutDigest;
  /** Kept up in the window before and untouched in this one. The one place
   * this file reports an absence, because an absence is a fact too. */
  quiet: string[];
  /** Nothing happened at all. Worth knowing before generating a paragraph
   * about it. */
  empty: boolean;
}

/** `from` inclusive, `to` exclusive, both YYYY-MM-DD. String comparison is
 * safe on this format and dodges every timezone question a Date would raise. */
const within = (day: string, from: string, to: string) => day >= from && day < to;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Deltas exist to be read aloud, so they carry one decimal at most. */
const delta = (now: number, before: number) => round1(now - before);

export function digestOf({ from, to, tasks, entries, trackers, workouts }: DigestInput): Digest {
  const days = Math.max(1, Math.round((Date.parse(`${to}T00:00`) - Date.parse(`${from}T00:00`)) / 86_400_000));
  const prevFrom = addDays(from, -days);
  const prevTo = from;

  return {
    from,
    to,
    days,
    previous: { from: prevFrom, to: prevTo },
    tasks: taskDigest(tasks, from, to, prevFrom, prevTo),
    trackers: trackerDigests(entries, trackers, from, to, prevFrom, prevTo),
    workouts: workoutDigest(workouts, from, to, prevFrom, prevTo),
    quiet: quietTrackers(entries, trackers, from, to, prevFrom, prevTo),
    empty: isEmpty(tasks, entries, workouts, from, to),
  };
}

/** A task's two dates mean different things and are stored differently.
 * `due_date` is date-only by contract (00:00Z), so its day is the first ten
 * characters; `done_at` and `created` are real instants and have to be read in
 * the local zone, or a task finished at 11pm lands on tomorrow. */
const doneDay = (t: Task) => (t.done_at ? localDateOf(t.done_at) : "");

function taskDigest(
  tasks: Task[],
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): TaskDigest {
  const finishedIn = (a: string, b: string) =>
    tasks.filter((t) => t.done_at && within(doneDay(t), a, b));

  const done = finishedIn(from, to).sort((a, b) => b.done_at.localeCompare(a.done_at));
  const byTag = new Map<string, number>();
  for (const t of done) for (const tag of t.tags) byTag.set(tag, (byTag.get(tag) ?? 0) + 1);

  return {
    done: done.length,
    created: tasks.filter((t) => t.created && within(localDateOf(t.created), from, to)).length,
    unfinished: tasks.filter(
      (t) => !t.done_at && t.due_date && within(dateOnly(t.due_date), from, to),
    ).length,
    finished: done.slice(0, MAX_TITLES).map((t) => t.title),
    byTag: [...byTag.entries()]
      .map(([tag, n]) => ({ tag, done: n }))
      .sort((a, b) => b.done - a.done || a.tag.localeCompare(b.tag)),
    doneDelta: done.length - finishedIn(prevFrom, prevTo).length,
  };
}

function trackerDigests(
  entries: Entry[],
  trackers: Tracker[],
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): TrackerDigest[] {
  const out: TrackerDigest[] = [];

  for (const tracker of trackers) {
    const mine = entries.filter((e) => e.tracker === tracker.id);
    const now = mine
      .filter((e) => within(localDateOf(e.at), from, to))
      .sort((a, b) => b.at.localeCompare(a.at));
    const before = mine.filter((e) => within(localDateOf(e.at), prevFrom, prevTo));
    // Never logged either side: nothing to report and nothing to miss.
    if (now.length === 0 && before.length === 0) continue;

    const measures =
      tracker.shape === "scale" || tracker.shape === "amount" || tracker.shape === "duration";
    const values = measures ? now.map((e) => e.value) : [];
    const prevValues = measures ? before.map((e) => e.value) : [];

    out.push({
      slug: tracker.slug,
      name: tracker.name,
      shape: tracker.shape,
      unit: tracker.unit,
      scaleMax: tracker.max,
      count: now.length,
      daysLogged: new Set(now.map((e) => localDateOf(e.at))).size,
      mean: values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      total: values.length ? round1(values.reduce((a, b) => a + b, 0)) : null,
      latest: now.length && measures ? now[0].value : null,
      meanDelta: meanDeltaOf(values, prevValues),
      countDelta: now.length - before.length,
      words: now
        .map((e) => e.body.trim())
        .filter(Boolean)
        .slice(0, MAX_WORDS),
    });
  }

  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The guardrail, in one place: two averages are only comparable when both
 * sides have enough readings to be an average of anything. */
function meanDeltaOf(now: number[], before: number[]): number | null {
  if (now.length < MIN_FOR_MEAN || before.length < MIN_FOR_MEAN) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return delta(avg(now), avg(before));
}

function workoutDigest(
  workouts: Workout[],
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): WorkoutDigest {
  // Filed sessions only. A workout still running has no duration to report and
  // no business in a summary of what is already done.
  const filed = workouts.filter((w) => w.ended_at);
  const inWindow = (a: string, b: string) =>
    filed
      .filter((w) => within(localDateOf(w.started_at), a, b))
      .sort((x, y) => y.started_at.localeCompare(x.started_at));

  const now = inWindow(from, to);
  const before = inWindow(prevFrom, prevTo);
  const volumeOf = (ws: Workout[]) => ws.reduce((v, w) => v + workoutVolume(w.entries), 0);

  const labels = new Map<string, number>();
  for (const w of now) {
    const focus = focusOf(w.entries);
    if (focus) labels.set(focus.label, (labels.get(focus.label) ?? 0) + 1);
  }

  return {
    count: now.length,
    // `workoutElapsed` needs a "now" for a running session; these are all
    // filed, so it never reaches for it.
    minutes: Math.round(now.reduce((ms, w) => ms + workoutElapsed(w, 0), 0) / 60_000),
    volume: Math.round(volumeOf(now)),
    sets: now.reduce((n, w) => n + workoutSetsDone(w.entries), 0),
    titles: now.slice(0, MAX_TITLES).map((w) => w.title),
    focus: [...labels.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    countDelta: now.length - before.length,
    volumeDelta: Math.round(volumeOf(now) - volumeOf(before)),
  };
}

/** Kept up before, dropped now. Reported by name because "you stopped logging
 * sleep" is the single most useful thing a weekly summary can notice, and it
 * is invisible in any count of what *did* happen. */
function quietTrackers(
  entries: Entry[],
  trackers: Tracker[],
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): string[] {
  const out: string[] = [];
  for (const tracker of trackers) {
    const mine = entries.filter((e) => e.tracker === tracker.id);
    const before = mine.filter((e) => within(localDateOf(e.at), prevFrom, prevTo)).length;
    const now = mine.filter((e) => within(localDateOf(e.at), from, to)).length;
    if (before > 0 && now === 0) out.push(tracker.name);
  }
  return out;
}

function isEmpty(
  tasks: Task[],
  entries: Entry[],
  workouts: Workout[],
  from: string,
  to: string,
): boolean {
  return (
    !tasks.some((t) => t.done_at && within(doneDay(t), from, to)) &&
    !entries.some((e) => within(localDateOf(e.at), from, to)) &&
    !workouts.some((w) => w.ended_at && within(localDateOf(w.started_at), from, to))
  );
}
