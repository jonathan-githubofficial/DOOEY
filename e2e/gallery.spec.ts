import { test, expect } from "@playwright/test";

// The L2-design layer's E2E surface (unit 2.3). Gallery has no auth guard yet (no router
// exists until unit 3.1), so this spec needs no PocketBase instance - it only exercises the
// primitives, tokens, fonts, and grain overlay rendered by the temporary app root.
test.describe("Gallery @l2", () => {
  test("renders every primitive, token, font, and the grain overlay", async ({ page }) => {
    await page.goto("/");

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
});
