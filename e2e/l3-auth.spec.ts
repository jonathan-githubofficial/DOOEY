import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

import { routerPathname, signOutVia } from './router-bridge'

// L3-shell-auth behavioural auth suite (unit 3.2). The 3.1 @l3 guard spec proves a signed-OUT
// visitor is bounced to the front door; this suite proves the rest of the session lifecycle on
// the real Lynx web output: the login card renders, a UI sign-in round-trips back into the app,
// signOut() drops the session and the guard reacts, and a signed-in session survives a reload.
//
// Memory history has no address bar, so every route assertion reads the router's own pathname
// through the __dooeyRouter worker bridge (router-bridge.ts); UI assertions read rendered
// content via data-testids that survive into the <lynx-view> shadow DOM. Never a URL.
//
// Element driving on the web target (verified against @lynx-js/web-elements + @lynx-js/web-core
// 0.22.2 source): the L2 <input> renders as <x-input> whose shadow <input> carries the real
// type/inputmode, and a native `input` event is teleported to the app's `bindinput`
// (W3cEventNameToLynx: lynxinput->input); a native `click` on the <view bindtap> Button is
// mapped to the Lynx `tap` (click->tap). So Playwright fill()/click() reach the worker handlers.

const EMAIL = 'input[inputmode="email"]'
const PASSWORD = 'input[type="password"]'

/** Fill the login card and tap "sign in", then wait for the guarded index. Exercises the full
 * UI path: bindinput -> React state -> the Button un-disables -> bindtap -> submit(). */
async function uiSignIn(page: Page, email: string, password: string): Promise<void> {
  await expect(page.getByTestId('signin-card')).toBeVisible()
  await page.locator(EMAIL).fill(email)
  await page.locator(PASSWORD).fill(password)
  // The submit Button is disabled (opacity-50) until both fields have propagated to the worker's
  // React state; wait for it to un-disable so the tap lands on a live bindtap.
  await expect(page.getByTestId('signin-submit')).toHaveCSS('opacity', '1')
  await page.getByTestId('signin-submit').click()
  await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
}

test.describe('Auth @l3', () => {
  test('@l3 auth: an unauthenticated visit shows the login card', async ({ page }) => {
    // Fresh boot, no stored session -> the guard sends "/" to the front door.
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('login-wordmark')).toBeVisible()
    await expect(page.getByTestId('login-wordmark')).toContainText('DOOEY')
    await expect(page.getByTestId('signin-card')).toBeVisible()
    await expect(page.getByTestId('signin-heading')).toBeVisible()

    await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/login')
  })

  test('@l3 auth: UI sign-in lands back at the app', async ({ page, creds }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await uiSignIn(page, creds.user.email, creds.user.password)

    // The guarded index renders and the login card is gone (unmounted with the /login route).
    await expect(page.getByTestId('signin-card')).toHaveCount(0)
    expect(await routerPathname(page)).toBe('/')
  })

  test('@l3 auth: sign-out returns to login', async ({ page, pb }) => {
    // Reach a signed-in state by seeding the session across the R11 storage seam (the proven
    // @l1 path: write the AsyncAuthStore payload into the host page's localStorage, reload,
    // let the app hydrate). Async hydration means the guard may transit /login first, so poll
    // for the settled guarded index.
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
    await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')

    // Drive the real signOut() API through the bridge; onChange -> invalidate re-runs the guard.
    await signOutVia(page)

    await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/login')
    await expect(page.getByTestId('signin-card')).toBeVisible()
  })

  test('@l3 auth: session survives a reload of the web app', async ({ page, creds }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await uiSignIn(page, creds.user.email, creds.user.password)

    // Confirm the session actually persisted across the storage seam before reloading (the
    // AsyncAuthStore save is async), so the reload is a genuine persistence test, not a race.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('pb_auth')), { timeout: 20_000 })
      .toBeTruthy()

    // Memory history restarts at "/" on reload; a still-authenticated user must land on the
    // guarded index, NOT be bounced to /login.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await expect(page.getByTestId('signin-card')).toHaveCount(0)
  })
})
