import { resolveDock, spaceFor, SPACES } from "./spaces";

describe("SPACES", () => {
  it("leads with the Planner and ends with Account", () => {
    expect(SPACES[0].route).toBe("index");
    expect(SPACES[0].label).toBe("Planner");
    expect(SPACES[SPACES.length - 1].route).toBe("account");
  });
});

describe("resolveDock", () => {
  it("pins the Planner first and Account last around the visible middle", () => {
    expect(resolveDock(["boards", "projects", "gym"], [])).toEqual([
      "index",
      "boards",
      "projects",
      "gym",
      "account",
    ]);
  });
  it("drops hidden spaces but never the pinned ends", () => {
    expect(resolveDock(["boards", "projects", "gym"], ["boards", "projects"])).toEqual([
      "index",
      "gym",
      "account",
    ]);
  });
  it("respects a custom order", () => {
    expect(resolveDock(["gym", "boards", "projects"], ["projects"])).toEqual([
      "index",
      "gym",
      "boards",
      "account",
    ]);
  });
});

describe("spaceFor", () => {
  it("maps every space route to itself", () => {
    for (const s of SPACES) expect(spaceFor(s.route)).toBe(s.route);
  });
  it("falls back to account for shell pages", () => {
    expect(spaceFor("style")).toBe("account");
  });
});
