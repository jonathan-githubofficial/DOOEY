import {
  defaultsFor,
  formatDuration,
  formatValue,
  parseDuration,
  slugify,
  type Tracker,
} from "./types";

const tracker = (over: Partial<Tracker>): Tracker => ({
  id: "t1",
  name: "Mood",
  slug: "mood",
  shape: "scale",
  unit: "",
  min: 1,
  max: 5,
  hue: "sky",
  position: 0,
  archived: false,
  ...over,
});

describe("slugify", () => {
  it("reduces a name to a stable key", () => {
    expect(slugify("Sleep")).toBe("sleep");
    expect(slugify("Body weight")).toBe("body-weight");
    expect(slugify("  Water!! ")).toBe("water");
  });

  it("never returns an empty key", () => {
    expect(slugify("???")).toBe("tracker");
    expect(slugify("")).toBe("tracker");
  });

  it("tails a collision rather than colliding, because the index is unique", () => {
    expect(slugify("Water", ["water"])).toBe("water-2");
    expect(slugify("Water", ["water", "water-2"])).toBe("water-3");
  });
});

describe("parseDuration", () => {
  it("takes a length the way it gets said", () => {
    expect(parseDuration("7h 20m")).toBe(440);
    expect(parseDuration("7h20")).toBe(440);
    expect(parseDuration("7 hours 20 mins")).toBe(440);
    expect(parseDuration("7h")).toBe(420);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("1:20")).toBe(80);
  });

  it("reads a bare number as minutes, the unit it is stored in", () => {
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration(" 90 ")).toBe(90);
  });

  it("takes halves, comma or point", () => {
    expect(parseDuration("7.5h")).toBe(450);
    expect(parseDuration("7,5h")).toBe(450);
  });

  it("refuses what it cannot read rather than filing a zero", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("slept well")).toBeNull();
    expect(parseDuration("0")).toBeNull();
    expect(parseDuration("0h 0m")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
  });

  it("round-trips what formatDuration prints", () => {
    for (const minutes of [15, 45, 60, 90, 440]) {
      expect(parseDuration(formatDuration(minutes))).toBe(minutes);
    }
  });
});

describe("formatDuration", () => {
  it("says minutes the way people do", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(440)).toBe("7h 20m");
  });

  it("drops the minutes on a whole hour", () => {
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("formatValue", () => {
  it("reads a scale against its ceiling", () => {
    expect(formatValue(tracker({}), 4)).toBe("4 of 5");
  });

  it("carries the unit on an amount, and copes without one", () => {
    expect(formatValue(tracker({ shape: "amount", unit: "kg" }), 78)).toBe("78 kg");
    expect(formatValue(tracker({ shape: "amount", unit: "" }), 78)).toBe("78");
  });

  it("renders a duration as time, not as a count of minutes", () => {
    expect(formatValue(tracker({ shape: "duration" }), 440)).toBe("7h 20m");
  });

  it("measures nothing for words and ticks — those live in the body", () => {
    expect(formatValue(tracker({ shape: "text" }), 0)).toBe("");
    expect(formatValue(tracker({ shape: "tick" }), 1)).toBe("");
  });
});

describe("defaultsFor", () => {
  it("opens a scale on 1 to 5 rather than on nothing", () => {
    expect(defaultsFor("scale")).toEqual({ unit: "", min: 1, max: 5 });
  });

  it("leaves the measuring fields alone for the shapes that don't measure", () => {
    expect(defaultsFor("text")).toEqual({ unit: "", min: 0, max: 0 });
    expect(defaultsFor("tick")).toEqual({ unit: "", min: 0, max: 0 });
  });
});
