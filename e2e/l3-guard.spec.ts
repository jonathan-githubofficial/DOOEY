import { test, expect } from '@playwright/test'

import { routerPathname } from './router-bridge'

// L3-shell-auth layer E2E surface (unit 3.1). Proves the pathless `app` guard: a fresh boot
// with NO stored session is bounced to the login front door. The behavioural session-DROP
// re-guard (onChange -> router.invalidate) and the redirect round-trip land in 3.2.
//
// Memory history has no address bar, so we assert on the RENDERED front door (the wordmark
// <text>, deep-queried through the lynx-view shadow DOM) AND on the router's own pathname via
// the E2E bridge (see router-bridge.ts). No session is seeded, so pb.authStore is invalid and
// the guard redirects "/" -> "/login".
test.describe('Guard @l3', () => {
  test('@l3 guard: a signed-out visitor is sent to the login screen', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // The login front door renders (assert on rendered <text>, NOT a URL).
    await expect(page.getByTestId('login-wordmark')).toBeVisible()
    await expect(page.getByTestId('login-wordmark')).toContainText('DOOEY')

    // ...and the guard actually redirected the guarded index to the login route.
    await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/login')
  })
})
