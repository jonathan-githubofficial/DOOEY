import { resolveDock, spaceFor, SPACES } from "./spaces";

describe("SPACES", () => {
  it("leads with Home and ends with Account", () => {
    expect(SPACES[0].route).toBe("index");
    expect(SPACES[0].label).toBe("Home");
    expect(SPACES[SPACES.length - 1].route).toBe("account");
  });
  it("has a planner route for the calendar space", () => {
    expect(SPACES.map((s) => s.route)).toContain("planner");
  });
});

describe("resolveDock", () => {
  it("pins Home first and Account last around the visible middle", () => {
    expect(resolveDock(["planner", "boards", "projects", "gym"], [])).toEqual([
      "index",
      "planner",
      "boards",
      "projects",
      "gym",
      "account",
    ]);
  });
  it("drops hidden spaces but never the pinned ends", () => {
    expect(resolveDock(["planner", "boards", "projects", "gym"], ["boards", "projects"])).toEqual([
      "index",
      "planner",
      "gym",
      "account",
    ]);
  });
  it("respects a custom order", () => {
    expect(resolveDock(["gym", "planner", "boards", "projects"], ["projects"])).toEqual([
      "index",
      "gym",
      "planner",
      "boards",
      "account",
    ]);
  });
});

describe("spaceFor", () => {
  it("maps every space route to itself", () => {
    for (const s of SPACES) expect(spaceFor(s.route)).toBe(s.route);
  });
  it("keeps drill-ins lighting their parent stop", () => {
    expect(spaceFor("task/[id]")).toBe("planner");
    expect(spaceFor("compose")).toBe("planner");
    expect(spaceFor("board/[id]")).toBe("boards");
    expect(spaceFor("project/[id]")).toBe("projects");
    expect(spaceFor("workout/[id]")).toBe("gym");
    expect(spaceFor("routine/[id]")).toBe("gym");
  });
  it("falls back to account for shell pages", () => {
    expect(spaceFor("style")).toBe("account");
  });
});
