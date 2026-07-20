import { test, expect } from "@playwright/test";

import { navigateVia } from "./router-bridge";

// The L2-design layer's E2E surface (unit 2.3). Unit 3.1 moved the gallery off the app root
// onto the PUBLIC `/gallery` route, so this spec now navigates there via the E2E router bridge
// (memory history has no address bar) before asserting. It still needs no signed-in session -
// /gallery is public - it only exercises the primitives, tokens, fonts, and grain overlay.
test.describe("Gallery @l2", () => {
  test("renders every primitive, token, font, and the grain overlay", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await navigateVia(page, "/gallery");

    await expect(page.getByTestId("gallery-title")).toBeVisible();
    await expect(page.getByTestId("gallery-tokens")).toBeVisible();
    await expect(page.getByTestId("gallery-panel")).toBeVisible();
    await expect(page.getByTestId("gallery-stamps")).toBeVisible();
    await expect(page.getByTestId("gallery-buttons")).toBeVisible();
    await expect(page.getByTestId("gallery-card")).toBeVisible();
    await expect(page.getByTestId("gallery-input")).toBeVisible();

    // Shadow/token styles actually applied (not just present in markup).
    const panelShadow = await page.getByTestId("gallery-panel").evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(panelShadow).not.toBe("none");

    // Fonts: each weight resolves to its own family per unit 2.1's fonts.css mapping.
    const outfit600 = await page.getByText("Outfit 600 semibold").evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(outfit600).toContain("Outfit-600");
    const fraunces900 = await page.getByText("Fraunces 900 black").evaluate(
      (el) => getComputedStyle(el).fontFamily,
    );
    expect(fraunces900).toContain("Fraunces-900");

    // Grain overlay is a real, visible (non-zero-opacity) element - not a removed
    // pseudo-element.
    const grainOpacity = await page.locator(".grain-tile").first().evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(Number(grainOpacity)).toBeGreaterThan(0);
  });

  test("renders the resolved icon set, folder shell, and squiggle", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await navigateVia(page, "/gallery");
    await expect(page.getByTestId("gallery-icons")).toBeVisible();
    // Lynx's <svg> host element renders on web as the custom element <x-svg> (its `content`
    // XML is loaded through an internal blob-URL <img> in that element's own shadow root,
    // not exposed as nested real <svg>/<path> DOM nodes) - confirmed via @lynx-js/web-elements
    // XSvg source and a build+screenshot smoke test (this unit's commit message has the
    // finding, including a real xmlns-less-content bug the smoke test caught: the internal
    // <img> silently fails to decode - and paint - without an `xmlns` on the standalone SVG
    // document, so every hand-authored icon's `content` string declares its own xmlns).
    const iconSvgCount = await page.locator('[data-testid="gallery-icons"] x-svg').count();
    expect(iconSvgCount).toBeGreaterThanOrEqual(3);
    await expect(page.getByTestId("gallery-folder-shell")).toBeVisible();
    await expect(page.getByTestId("gallery-squiggle")).toBeVisible();
  });
});
