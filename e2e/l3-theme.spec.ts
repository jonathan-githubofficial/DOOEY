import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'

// L3-shell-auth theme suite (unit 3.4). Proves the Lynx theme mechanism on the real web output:
// the app boots LIGHT (the default), the wordmark-dot toggle flips it to DARK, and dark PERSISTS
// across a reload via the R11 storage adapter. Also smoke-tests that the ported Style studio
// renders and that applying a preset drives the live CSS-variable cascade.
//
// The theme is applied by <ThemeVars> (src/features/style/ThemeVars.tsx): the app-root <view>
// carries the resolved palette as inline CSS variables + a `dark` class. So the assertion reads a
// CSS variable straight off that root view's computed style (data-testid "theme-root"), which
// survives into the <lynx-view> shadow DOM - rendered/computed style, never a URL. The light paper
// triplet is `44 26% 95%`, dark is `28 10% 9%` (styles/global.css + tokens.ts DEFAULT_COLORS).

/** Read a CSS custom property off the app-root ThemeVars view (computed style). */
async function readVar(page: Page, prop: string): Promise<string> {
  return page
    .getByTestId('theme-root')
    .first()
    .evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), prop)
}

/** Reach a signed-in shell by seeding the session across the R11 storage seam (the proven @l3
 * path: write the AsyncAuthStore payload into the host page's localStorage, reload, let the app
 * hydrate). Async hydration can transit /login first, so poll for the settled guarded index. */
async function signInAndLand(page: Page, pb: PocketBase): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
}

test.describe('Theme @l3', () => {
  test('@l3 theme: light is the default and dark persists across reload', async ({ page, pb }) => {
    await signInAndLand(page, pb)

    // Boots LIGHT (the default): --paper on the root view is the light triplet.
    await expect.poll(() => readVar(page, '--paper'), { timeout: 20_000 }).toBe('44 26% 95%')

    // Flip to dark via the wordmark full-stop in the dock (calls useThemeStore.toggle()).
    await page.getByTestId('dock-theme-dot').click()
    await expect.poll(() => readVar(page, '--paper'), { timeout: 20_000 }).toBe('28 10% 9%')

    // Confirm the flip actually reached the storage adapter before reloading (the persist write is
    // async across the native-module seam), so the reload is a genuine persistence test, not a race.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('dooey-theme')), { timeout: 20_000 })
      .toContain('dark')

    // Reload: memory history restarts at "/", the session is still seeded, and the persisted theme
    // must rehydrate to DARK (not flash back to the light default and stay there).
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => readVar(page, '--paper'), { timeout: 30_000 }).toBe('28 10% 9%')
  })

  test('@l3 theme: the Style studio renders and a preset drives the palette', async ({
    page,
    pb,
  }) => {
    await signInAndLand(page, pb)

    // The Account "Style studio" link lands on the real /style page (3.4 replaced 3.3's interim).
    await navigateVia(page, '/style')
    await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/style')
    await expect(page.getByTestId('page-style')).toBeVisible()
    await expect(page.getByTestId('style-studio')).toBeVisible()

    // Applying a preset recolours the whole app live: the Meadow preset's light paper is
    // `96 22% 94%`, so --paper on the root view changes to it (we boot in the light look).
    await page.getByTestId('preset-meadow').click()
    await expect.poll(() => readVar(page, '--paper'), { timeout: 20_000 }).toBe('96 22% 94%')
  })
})
