import { daysStamped, monthGrid, monthRange, streakOf } from "./album";
import type { Entry, Tracker } from "./types";

// 2026-08-05 is a Wednesday. August 2026 opens on a Saturday and has 31 days.
const TODAY = "2026-08-05";
const MONTH = "2026-08";

const tracker = (over: Partial<Tracker>): Tracker => ({
  id: "food",
  name: "Food",
  slug: "food",
  shape: "text",
  unit: "",
  min: 0,
  max: 0,
  hue: "honey",
  position: 0,
  archived: false,
  ...over,
});

const entry = (day: string, over: Partial<Entry> = {}): Entry => ({
  id: `${day}-${over.tracker ?? "food"}-${over.body ?? ""}`,
  tracker: "food",
  at: `${day}T12:00:00`,
  body: "eggs",
  value: 0,
  ...over,
});

const FOOD = tracker({});
const MOOD = tracker({ id: "mood", name: "Mood", slug: "mood", hue: "sky", position: 1 });

const build = (
  entries: Entry[],
  workoutDays: { date: string; id: string }[] = [],
  month = MONTH,
) => monthGrid({ month, entries, trackers: [FOOD, MOOD], workoutDays, today: TODAY });

const cellFor = (rows: ReturnType<typeof build>, date: string) =>
  rows.flat().find((d) => d.date === date)!;

describe("monthRange", () => {
  it("covers six whole weeks from the Monday the grid opens on", () => {
    // August 2026 starts on a Saturday, so the grid opens on Monday July 27th.
    expect(monthRange(MONTH)).toEqual({ from: "2026-07-27", to: "2026-09-07" });
  });
});

describe("monthGrid", () => {
  it("lays the month out in whole weeks, Monday first", () => {
    const rows = build([]);
    expect(rows[0].map((d) => d.date)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("marks the spill from either side so it can be drawn faint", () => {
    const rows = build([]);
    expect(cellFor(rows, "2026-07-31").outside).toBe(true);
    expect(cellFor(rows, "2026-08-01").outside).toBe(false);
    expect(cellFor(rows, "2026-09-01").outside).toBe(true);
  });

  it("drops a trailing row that would be entirely next month", () => {
    // February 2027 opens on a Monday and has 28 days: exactly four weeks, so
    // rows five and six would both be pure spill.
    const rows = build([], [], "2027-02");
    expect(rows).toHaveLength(4);
  });

  it("carries the day of the month for the numeral", () => {
    expect(cellFor(build([]), "2026-08-09").day).toBe(9);
  });

  it("marks a day once per tracker, however many times it was stamped", () => {
    const rows = build([entry(TODAY), entry(TODAY, { body: "toast" }), entry(TODAY, { body: "soup" })]);
    const day = cellFor(rows, TODAY);
    expect(day.hues).toEqual(["honey"]);
    expect(day.count).toBe(3);
  });

  it("orders a day's marks by the user's arrangement, not by when they landed", () => {
    const rows = build([entry(TODAY, { tracker: "mood", id: "m1" }), entry(TODAY, { id: "f1" })]);
    expect(cellFor(rows, TODAY).hues).toEqual(["honey", "sky"]);
  });

  it("ignores an entry whose tracker is gone rather than drawing a colourless mark", () => {
    const day = cellFor(build([entry(TODAY, { tracker: "deleted", id: "x" })]), TODAY);
    expect(day.hues).toEqual([]);
    // The stamp still happened, so the day is not silently empty.
    expect(day.count).toBe(1);
  });

  it("separates today, the days behind it, and the days still to come", () => {
    const rows = build([]);
    expect(cellFor(rows, TODAY).isToday).toBe(true);
    expect(cellFor(rows, "2026-08-04").ahead).toBe(false);
    expect(cellFor(rows, "2026-08-06").ahead).toBe(true);
  });

  it("carries the session trained that day", () => {
    const rows = build([], [{ date: "2026-08-04", id: "w1" }]);
    expect(cellFor(rows, "2026-08-04").workoutId).toBe("w1");
  });
});

describe("streakOf", () => {
  it("counts back from today", () => {
    expect(streakOf(["2026-08-03", "2026-08-04", "2026-08-05"], TODAY)).toBe(3);
  });

  it("survives the morning: yesterday still counts before you have logged today", () => {
    expect(streakOf(["2026-08-03", "2026-08-04"], TODAY)).toBe(2);
  });

  it("is over once two days have passed with nothing", () => {
    expect(streakOf(["2026-08-01", "2026-08-02", "2026-08-03"], TODAY)).toBe(0);
  });

  it("is zero for a tracker that has never been stamped", () => {
    expect(streakOf([], TODAY)).toBe(0);
  });

  it("stops at the gap rather than counting every day ever logged", () => {
    expect(streakOf(["2026-07-01", "2026-08-04", "2026-08-05"], TODAY)).toBe(2);
  });
});

describe("daysStamped", () => {
  it("collects the distinct local days one tracker was stamped on", () => {
    const days = daysStamped(
      [
        entry(TODAY),
        entry(TODAY, { body: "toast" }),
        entry("2026-08-04"),
        entry(TODAY, { tracker: "mood", id: "m" }),
      ],
      "food",
    );
    expect([...days].sort()).toEqual(["2026-08-04", "2026-08-05"]);
  });
});
