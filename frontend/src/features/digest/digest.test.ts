import type { Task } from "@/features/tasks/types";
import type { Entry, Tracker } from "@/features/trackers/types";
import type { Workout, WorkoutEntry } from "@/features/workouts/types";
import { digestOf, MIN_FOR_MEAN, type DigestInput } from "./digest";

// A fixed week, so nothing here depends on when the suite runs.
const FROM = "2026-08-03"; // Monday
const TO = "2026-08-10"; // the Monday after, exclusive

/** Local midnight-relative instant, written the way the records store one.
 * Built from parts rather than a literal so the test reads in the same
 * timezone the code does — a UTC literal would pass in London and fail in
 * Montreal, which is exactly the bug this file exists to catch. */
const at = (day: string, hh = 12, mm = 0): string => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0).toISOString();
};

const task = (over: Partial<Task> = {}): Task => ({
  id: Math.random().toString(36).slice(2),
  title: "A task",
  description: "",
  due_date: "",
  done_at: "",
  notes: "",
  checklist: [],
  resources: [],
  attachments: [],
  tags: [],
  sort_order: 0,
  start_min: 0,
  dur_min: 60,
  project: "",
  gate: false,
  created: at(FROM),
  ...over,
});

const tracker = (over: Partial<Tracker> = {}): Tracker => ({
  id: "tr-sleep",
  name: "Sleep",
  slug: "sleep",
  shape: "duration",
  unit: "min",
  min: 0,
  max: 0,
  hue: "sky",
  position: 0,
  archived: false,
  ...over,
});

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: Math.random().toString(36).slice(2),
  tracker: "tr-sleep",
  at: at(FROM),
  body: "",
  value: 0,
  ...over,
});

const lift = (weight: number, reps: number, done = true): WorkoutEntry => ({
  name: "bench press",
  kind: "weight_reps",
  sets: [{ weight, reps, done }],
});

const workout = (over: Partial<Workout> = {}): Workout => ({
  id: Math.random().toString(36).slice(2),
  title: "Push",
  routine: "",
  started_at: at(FROM, 18),
  ended_at: at(FROM, 19),
  paused_at: "",
  paused_ms: 0,
  entries: [lift(60, 10)],
  photo: "",
  ...over,
});

const run = (over: Partial<DigestInput> = {}) =>
  digestOf({
    from: FROM,
    to: TO,
    tasks: [],
    entries: [],
    trackers: [],
    workouts: [],
    ...over,
  });

describe("the window", () => {
  it("compares against the equally long stretch before it", () => {
    const d = run();
    expect(d.days).toBe(7);
    expect(d.previous).toEqual({ from: "2026-07-27", to: "2026-08-03" });
  });

  it("knows when nothing happened", () => {
    expect(run().empty).toBe(true);
    expect(run({ tasks: [task({ done_at: at(FROM) })] }).empty).toBe(false);
  });

  it("counts an open task as no reason to call the week empty", () => {
    // Something merely *due* is not something that happened.
    expect(run({ tasks: [task({ due_date: `${FROM} 00:00:00.000Z` })] }).empty).toBe(true);
  });
});

describe("tasks", () => {
  it("counts what was finished inside the window, whenever it was due", () => {
    const d = run({
      tasks: [
        task({ title: "Dishes", done_at: at("2026-08-05"), due_date: "2026-07-01 00:00:00.000Z" }),
        task({ title: "Call mum", done_at: at("2026-08-09") }),
        task({ title: "Old news", done_at: at("2026-07-30") }), // previous window
      ],
    });
    expect(d.tasks.done).toBe(2);
    expect(d.tasks.finished).toEqual(["Call mum", "Dishes"]); // most recent first
    expect(d.tasks.doneDelta).toBe(1); // 2 this week against 1 last
  });

  it("counts what is due in the window and still open", () => {
    const d = run({
      tasks: [
        task({ due_date: "2026-08-05 00:00:00.000Z" }),
        task({ due_date: "2026-08-06 00:00:00.000Z", done_at: at("2026-08-06") }),
        task({ due_date: "2026-08-20 00:00:00.000Z" }),
      ],
    });
    expect(d.tasks.unfinished).toBe(1);
  });

  it("tallies completions by tag, busiest first", () => {
    const d = run({
      tasks: [
        task({ done_at: at("2026-08-04"), tags: ["gym", "morning"] }),
        task({ done_at: at("2026-08-05"), tags: ["gym"] }),
        task({ done_at: at("2026-08-06"), tags: ["admin"] }),
      ],
    });
    expect(d.tasks.byTag).toEqual([
      { tag: "gym", done: 2 },
      { tag: "admin", done: 1 },
      { tag: "morning", done: 1 },
    ]);
  });

  it("reads a late finish in the local day, not the stored one", () => {
    // 11pm on the last day of the window. Stored as UTC, this can carry into
    // the next calendar day; it still belongs to the week it was finished in.
    const d = run({ tasks: [task({ done_at: at("2026-08-09", 23, 30) })] });
    expect(d.tasks.done).toBe(1);
  });

  it("leaves a finish just past the edge out", () => {
    const d = run({ tasks: [task({ done_at: at("2026-08-10", 0, 30) })] });
    expect(d.tasks.done).toBe(0);
  });
});

describe("trackers", () => {
  it("reports readings, the days they fell on, and the spread", () => {
    const d = run({
      trackers: [tracker()],
      entries: [
        entry({ at: at("2026-08-03"), value: 400 }),
        entry({ at: at("2026-08-04"), value: 440 }),
        entry({ at: at("2026-08-04", 15), value: 420 }), // same day, second nap
      ],
    });
    const sleep = d.trackers[0];
    expect(sleep.count).toBe(3);
    expect(sleep.daysLogged).toBe(2);
    expect(sleep.mean).toBe(420);
    expect(sleep.min).toBe(400);
    expect(sleep.max).toBe(440);
    expect(sleep.total).toBe(1260);
    expect(sleep.latest).toBe(420); // most recent instant, not the largest
  });

  it("leaves the measuring fields null for words and ticks", () => {
    const d = run({
      trackers: [tracker({ id: "tr-food", slug: "food", name: "Food", shape: "text" })],
      entries: [entry({ tracker: "tr-food", body: "eggs and toast" })],
    });
    const food = d.trackers[0];
    expect(food.mean).toBeNull();
    expect(food.total).toBeNull();
    expect(food.latest).toBeNull();
    expect(food.words).toEqual(["eggs and toast"]);
  });

  it("keeps the logger's own words and never rewrites them", () => {
    const d = run({
      trackers: [tracker({ id: "tr-food", slug: "food", name: "Food", shape: "text" })],
      entries: [
        entry({ tracker: "tr-food", at: at("2026-08-03"), body: "eggs" }),
        entry({ tracker: "tr-food", at: at("2026-08-04"), body: "  " }), // blank, dropped
        entry({ tracker: "tr-food", at: at("2026-08-05"), body: "too much bread" }),
      ],
    });
    expect(d.trackers[0].words).toEqual(["too much bread", "eggs"]);
  });

  it("ignores a tracker nobody logged on either side", () => {
    const d = run({ trackers: [tracker()], entries: [] });
    expect(d.trackers).toEqual([]);
  });

  it("orders trackers by how much they were used", () => {
    const d = run({
      trackers: [
        tracker(),
        tracker({ id: "tr-food", slug: "food", name: "Food", shape: "text" }),
      ],
      entries: [
        entry({ value: 400 }),
        entry({ tracker: "tr-food", body: "a" }),
        entry({ tracker: "tr-food", body: "b" }),
      ],
    });
    expect(d.trackers.map((t) => t.slug)).toEqual(["food", "sleep"]);
  });
});

describe("the honesty guardrail", () => {
  const week = (day: string, values: number[]) =>
    values.map((v, i) => entry({ at: at(day, 8 + i), value: v }));

  it("compares two averages once both sides have enough readings", () => {
    const d = run({
      trackers: [tracker()],
      entries: [
        ...week("2026-08-04", [400, 400, 400]), // this week, mean 400
        ...week("2026-07-28", [430, 430, 430]), // last week, mean 430
      ],
    });
    expect(d.trackers[0].meanDelta).toBe(-30);
  });

  it("refuses to compare when this side is too thin", () => {
    const d = run({
      trackers: [tracker()],
      entries: [
        ...week("2026-08-04", [400, 400]), // two readings
        ...week("2026-07-28", [430, 430, 430, 430]),
      ],
    });
    // Null means "not enough to say" and must never be shown as no change.
    expect(d.trackers[0].meanDelta).toBeNull();
  });

  it("refuses to compare when the other side is too thin", () => {
    const d = run({
      trackers: [tracker()],
      entries: [...week("2026-08-04", [400, 400, 400, 400]), ...week("2026-07-28", [430, 430])],
    });
    expect(d.trackers[0].meanDelta).toBeNull();
  });

  it("still reports the change in how often it was logged", () => {
    // A count is a complete tally, not a sample, so it is always safe to state
    // even when the averages are not comparable.
    const d = run({
      trackers: [tracker()],
      entries: [...week("2026-08-04", [400, 400]), ...week("2026-07-28", [430])],
    });
    expect(d.trackers[0].meanDelta).toBeNull();
    expect(d.trackers[0].countDelta).toBe(1);
  });

  it("holds the threshold at the documented number", () => {
    const enough = Array.from({ length: MIN_FOR_MEAN }, (_, i) => i);
    const d = run({
      trackers: [tracker()],
      entries: [
        ...week("2026-08-04", enough.map(() => 400)),
        ...week("2026-07-28", enough.map(() => 400)),
      ],
    });
    expect(d.trackers[0].meanDelta).toBe(0);
  });
});

describe("workouts", () => {
  it("counts filed sessions, their time, volume and sets", () => {
    const d = run({
      workouts: [
        workout({ started_at: at("2026-08-04", 18), ended_at: at("2026-08-04", 19) }),
        workout({
          title: "Legs",
          started_at: at("2026-08-06", 18),
          ended_at: at("2026-08-06", 18, 30),
          entries: [lift(100, 5), lift(50, 10, false)], // the undone set counts for nothing
        }),
      ],
    });
    expect(d.workouts.count).toBe(2);
    expect(d.workouts.minutes).toBe(90);
    expect(d.workouts.volume).toBe(60 * 10 + 100 * 5);
    expect(d.workouts.sets).toBe(2);
    expect(d.workouts.titles).toEqual(["Legs", "Push"]);
  });

  it("takes banked pauses off the time trained", () => {
    const d = run({
      workouts: [
        workout({
          started_at: at("2026-08-04", 18),
          ended_at: at("2026-08-04", 19),
          paused_ms: 10 * 60_000,
        }),
      ],
    });
    expect(d.workouts.minutes).toBe(50);
  });

  it("leaves a session still running out of it", () => {
    const d = run({ workouts: [workout({ ended_at: "" })] });
    expect(d.workouts.count).toBe(0);
    expect(d.empty).toBe(true);
  });

  it("tallies what was trained, most sessions first", () => {
    // Real library ids, because the muscle a session worked is looked up from
    // the exercise library rather than stored on the session.
    const chest = { ...lift(60, 10), libId: "27NNGFr" };
    const quads = { ...lift(80, 8), libId: "T2fA5Ir" };
    const d = run({
      workouts: [
        workout({ started_at: at("2026-08-03", 18), ended_at: at("2026-08-03", 19), entries: [chest] }),
        workout({ started_at: at("2026-08-05", 18), ended_at: at("2026-08-05", 19), entries: [quads] }),
        workout({ started_at: at("2026-08-07", 18), ended_at: at("2026-08-07", 19), entries: [chest] }),
      ],
    });
    // The library's own word for the muscle, not the raw tag: "Chest", not
    // "pectorals". Whatever narrates this should never have to translate.
    expect(d.workouts.focus).toEqual([
      { label: "Chest", count: 2 },
      { label: "Quads", count: 1 },
    ]);
  });

  it("has no focus to report for a session of moves the library has never heard of", () => {
    const d = run({ workouts: [workout()] }); // no libId anywhere
    expect(d.workouts.focus).toEqual([]);
    expect(d.workouts.count).toBe(1); // still a session, still counted
  });

  it("compares sessions and volume with the week before", () => {
    const d = run({
      workouts: [
        workout({ started_at: at("2026-08-04", 18), ended_at: at("2026-08-04", 19) }),
        workout({ started_at: at("2026-07-29", 18), ended_at: at("2026-07-29", 19) }),
        workout({ started_at: at("2026-07-30", 18), ended_at: at("2026-07-30", 19) }),
      ],
    });
    expect(d.workouts.countDelta).toBe(-1);
    expect(d.workouts.volumeDelta).toBe(-600);
  });
});

describe("what stopped", () => {
  it("names a tracker kept up before and dropped this week", () => {
    const d = run({
      trackers: [tracker()],
      entries: [entry({ at: at("2026-07-29"), value: 400 })],
    });
    expect(d.quiet).toEqual(["Sleep"]);
  });

  it("says nothing about one that was never kept up in the first place", () => {
    const d = run({ trackers: [tracker()], entries: [entry({ at: at("2026-08-04"), value: 400 })] });
    expect(d.quiet).toEqual([]);
  });
});
