import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { routerPathname } from './router-bridge'

// L3-shell-auth dock suite (unit 3.3). Proves the persistent dock on the real Lynx web output:
// a signed-in user taps each of the four space tabs and the account cluster, the memory router
// lands on the tapped destination, the target screen renders (interim or real), and the active
// highlight tracks the tapped stop.
//
// Element driving (verified in the 3.2 auth suite + this run): each dock stop is a <view bindtap>
// (Lynx maps a native DOM click -> `tap`), so Playwright .click() reaches the worker handler,
// which calls the typed navigate({ to }). Route assertions read the router's own pathname through
// the __dooeyRouter worker bridge (memory history has no address bar). Content + highlight
// assertions read data-testids that survive into the <lynx-view> shadow DOM.

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

test.describe('Dock @l3', () => {
  test('@l3 dock: tab navigation moves between spaces', async ({ page, pb }) => {
    await signInAndLand(page, pb)
    // The dock is mounted in the authed shell.
    await expect(page.getByTestId('dock')).toBeVisible()

    // Each of the four tabs + the account cluster: a real tap lands on the destination, the
    // target screen renders, and the active-highlight <view> sits on the tapped stop.
    const stops = [
      { testid: 'dock-calendar', path: '/calendar', content: 'page-calendar' },
      { testid: 'dock-boards', path: '/boards', content: 'page-boards' },
      { testid: 'dock-projects', path: '/projects', content: 'page-projects' },
      { testid: 'dock-account', path: '/account', content: 'page-account' },
    ] as const

    for (const stop of stops) {
      await page.getByTestId(stop.testid).click()
      await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe(stop.path)
      await expect(page.getByTestId(stop.content)).toBeVisible()
      // The highlight for the tapped stop is lit (opacity 1); it reflects the active stop.
      await expect(page.getByTestId(stop.testid).getByTestId('dock-highlight')).toHaveCSS(
        'opacity',
        '1',
      )
    }

    // Back to the planner: pathname returns to "/", the Account screen unmounts, and the planner
    // tab's highlight is now the lit one.
    await page.getByTestId('dock-planner').click()
    await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/')
    await expect(page.getByTestId('page-account')).toHaveCount(0)
    await expect(page.getByTestId('dock-planner').getByTestId('dock-highlight')).toHaveCSS(
      'opacity',
      '1',
    )
  })
})
