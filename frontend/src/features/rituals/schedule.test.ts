import {
  DAY_MINUTES,
  addTime,
  bandsFor,
  describeSchedule,
  newRitual,
  occurrencesFor,
  sanitizeRituals,
  setTime,
  toggleDay,
} from "./schedule";
import type { Ritual } from "./types";

// 2026-01-05 is a Monday; the week runs to Sunday the 11th.
const MONDAY = "2026-01-05";
const TUESDAY = "2026-01-06";
const SUNDAY = "2026-01-11";

const gym = (over: Partial<Ritual> = {}): Ritual => ({
  ...newRitual("gym", "r1", "routine1", "Push"),
  ...over,
});

describe("bandsFor", () => {
  it("gives a lone slot the whole day", () => {
    expect(bandsFor([8 * 60])).toEqual([{ from: 0, to: DAY_MINUTES }]);
  });
  it("splits neighbours at their midpoint and keeps the outer edges", () => {
    expect(bandsFor([8 * 60, 13 * 60, 19 * 60])).toEqual([
      { from: 0, to: 630 },
      { from: 630, to: 960 },
      { from: 960, to: DAY_MINUTES },
    ]);
  });
  it("leaves no gap between adjacent bands", () => {
    const bands = bandsFor([7 * 60, 9 * 60, 9 * 60 + 15]);
    bands.slice(1).forEach((b, i) => expect(b.from).toBe(bands[i].to));
  });
});

describe("occurrencesFor", () => {
  it("expands one slot per time on a matching weekday", () => {
    const occ = occurrencesFor(MONDAY, [gym({ days: [1], times: [7 * 60, 18 * 60] })]);
    expect(occ.map((o) => o.start_min)).toEqual([420, 1080]);
    expect(occ.map((o) => o.index)).toEqual([1, 2]);
    expect(occ[0].count).toBe(2);
    expect(occ[0].id).toBe(`r1@${MONDAY}#0`);
  });
  it("skips days the ritual does not fall on", () => {
    expect(occurrencesFor(TUESDAY, [gym({ days: [1] })])).toEqual([]);
  });
  it("reads Sunday as day 0", () => {
    expect(occurrencesFor(SUNDAY, [gym({ days: [0] })])).toHaveLength(1);
  });
  it("expands nothing for a disabled, dayless or timeless ritual", () => {
    expect(occurrencesFor(MONDAY, [gym({ days: [1], enabled: false })])).toEqual([]);
    expect(occurrencesFor(MONDAY, [gym({ days: [] })])).toEqual([]);
    expect(occurrencesFor(MONDAY, [gym({ days: [1], times: [] })])).toEqual([]);
  });
  it("interleaves rituals in clock order", () => {
    const meals = { ...newRitual("journal", "r2"), days: [1], times: [8 * 60, 19 * 60] };
    const occ = occurrencesFor(MONDAY, [gym({ days: [1], times: [12 * 60] }), meals]);
    expect(occ.map((o) => o.ritual.id)).toEqual(["r2", "r1", "r2"]);
  });
});

describe("sanitizeRituals", () => {
  it("drops entries with no id or an unknown kind", () => {
    expect(sanitizeRituals([{ kind: "gym" }, { id: "x", kind: "sleep" }, null])).toEqual([]);
  });
  it("returns empty for anything that is not a list", () => {
    expect(sanitizeRituals(undefined)).toEqual([]);
    expect(sanitizeRituals({ id: "x" })).toEqual([]);
  });
  it("sorts, dedupes, snaps and range-checks the times", () => {
    const [r] = sanitizeRituals([
      { id: "a", kind: "journal", times: [1300, 480, 487, 480, -5, 5000], days: [3, 3, 9, 0] },
    ]);
    expect(r.times).toEqual([480, 1305]);
    expect(r.days).toEqual([0, 3]);
  });
  it("drops a negative time rather than rounding it up to midnight", () => {
    expect(sanitizeRituals([{ id: "a", kind: "gym", times: [-5, -1] }])[0].times).toEqual([]);
  });
  it("clamps a time that snaps past the end of the day", () => {
    expect(sanitizeRituals([{ id: "a", kind: "gym", times: [1439] }])[0].times).toEqual([1425]);
  });
  it("falls back to the kind's defaults for a missing label and duration", () => {
    const [r] = sanitizeRituals([{ id: "a", kind: "gym", label: "  " }]);
    expect(r.label).toBe("Training");
    expect(r.dur_min).toBe(60);
    expect(r.enabled).toBe(true);
  });
});

describe("editing helpers", () => {
  it("toggles a day on and off, keeping the list sorted", () => {
    expect(toggleDay([3, 1], 5)).toEqual([1, 3, 5]);
    expect(toggleDay([1, 3, 5], 3)).toEqual([1, 5]);
  });
  it("adds a slot an hour after the last, or noon when there is none", () => {
    expect(addTime([8 * 60])).toEqual([480, 540]);
    expect(addTime([])).toEqual([12 * 60]);
  });
  it("always adds a slot, even hard against the end of the day", () => {
    expect(addTime([23 * 60 + 45])).toEqual([1410, 1425]);
    expect(addTime([23 * 60 + 30, 23 * 60 + 45])).toEqual([1395, 1410, 1425]);
  });
  it("re-sorts when a slot is moved past its neighbour", () => {
    expect(setTime([8 * 60, 13 * 60], 1, 6 * 60)).toEqual([360, 480]);
  });
});

describe("describeSchedule", () => {
  it("names the days and the times", () => {
    expect(describeSchedule(gym({ days: [1, 3, 5], times: [18 * 60] }))).toBe("Mon, Wed, Fri · 6p");
  });
  it("collapses a full week", () => {
    expect(describeSchedule(gym({ days: [0, 1, 2, 3, 4, 5, 6], times: [480, 780] }))).toBe(
      "Every day · 8a, 1p",
    );
  });
  it("says so when nothing is scheduled", () => {
    expect(describeSchedule(gym({ days: [] }))).toBe("Never");
    expect(describeSchedule(gym({ times: [] }))).toBe("Never");
  });
});
