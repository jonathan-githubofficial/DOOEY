import {
  DOCK_CHOICES,
  HOME_WIDGETS,
  moveItem,
  normalizeOrder,
  toggleKey,
  validKeys,
} from "./layout";

describe("normalizeOrder", () => {
  it("keeps a saved order, dropping unknowns and appending newcomers", () => {
    expect(normalizeOrder(["gym", "zombies", "planner"], DOCK_CHOICES)).toEqual([
      "gym",
      "planner",
      "boards",
      "projects",
    ]);
  });
  it("falls back to the canonical order when nothing was saved", () => {
    expect(normalizeOrder(null, DOCK_CHOICES)).toEqual([...DOCK_CHOICES]);
    expect(normalizeOrder(undefined, DOCK_CHOICES)).toEqual([...DOCK_CHOICES]);
  });
});

describe("validKeys", () => {
  it("filters a saved subset down to keys that still exist", () => {
    expect(validKeys(["projects", "gone"], DOCK_CHOICES)).toEqual(["projects"]);
    expect(validKeys(undefined, DOCK_CHOICES)).toEqual([]);
  });
});

describe("moveItem", () => {
  it("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("clamps an out-of-range target", () => {
    expect(moveItem(["a", "b"], 0, 99)).toEqual(["b", "a"]);
  });
});

describe("toggleKey", () => {
  it("adds a missing key and removes a present one", () => {
    expect(toggleKey([], "gym")).toEqual(["gym"]);
    expect(toggleKey(["gym"], "gym")).toEqual([]);
  });
});

describe("HOME_WIDGETS", () => {
  it("ships schedule, tasks and gym", () => {
    expect(HOME_WIDGETS.map((w) => w.key)).toEqual(["schedule", "tasks", "gym"]);
  });
});
