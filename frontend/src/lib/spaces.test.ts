import { spaceFor, SPACES } from "./spaces";

describe("SPACES", () => {
  it("leads with Today and ends with Account", () => {
    expect(SPACES[0].route).toBe("index");
    expect(SPACES[0].label).toBe("Today");
    expect(SPACES[SPACES.length - 1].route).toBe("account");
  });

  it("names every route once, because this list is the bar", () => {
    const routes = SPACES.map((s) => s.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("gives every space a doodle key, which the native bar rasterizes by name", () => {
    for (const space of SPACES) expect(space.doodle).toBeTruthy();
  });
});

describe("spaceFor", () => {
  it("maps every space route to itself", () => {
    for (const s of SPACES) expect(spaceFor(s.route)).toBe(s.route);
  });

  it("falls back to account for shell pages reached from it", () => {
    expect(spaceFor("style")).toBe("account");
    expect(spaceFor("preferences")).toBe("account");
  });
});
