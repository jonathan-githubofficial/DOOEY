import { COMPOSE_SHEET } from "./compose-sheet";

/** The compose drawer was, for a long time, the only one in the app whose
 * height came from somewhere other than its content — first fractional
 * detents, then `fitToContents` — and the only one that showed a slab of empty
 * paper under the fields. It is now an ordinary transparent route with the
 * app's own bottom sheet inside it, like every other drawer.
 *
 * These assertions exist to keep it that way: re-introducing a `formSheet` or
 * any `sheetAllowedDetents` here is re-introducing the bug. */
describe("the compose route's presentation", () => {
  it("contributes nothing but transparency", () => {
    expect(COMPOSE_SHEET.presentation).toBe("transparentModal");
    expect(COMPOSE_SHEET.contentStyle).toEqual({ backgroundColor: "transparent" });
  });

  it("leaves the sliding to the sheet", () => {
    expect(COMPOSE_SHEET.animation).toBe("none");
  });

  it("declares no sheet height of any kind", () => {
    const options = COMPOSE_SHEET as Record<string, unknown>;
    expect(options.presentation).not.toBe("formSheet");
    for (const key of Object.keys(options)) {
      expect(key.startsWith("sheet")).toBe(false);
    }
  });
});
