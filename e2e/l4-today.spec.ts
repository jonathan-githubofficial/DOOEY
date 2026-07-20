import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { routerPathname } from './router-bridge'

// L4-tasks Today / Planner suite (unit 4.1). Proves the composed Planner space on the real Lynx web
// output + disposable PocketBase: the quick-add stamp opens the ComposerSheet, a typed task
// persists and appears in the day's AgendaSheet WITHOUT a reload (realtime through useTasksLive +
// the L1 lynx.EventSource seam / the create mutation's cache invalidation), and survives a reload;
// and a signed-out visit to "/" is held at the login front door by the L3 guard.
//
// This unit is the LAST L4 unit to land (ruling R4: 4.2 -> 4.3 -> 4.1), so the whole tasks cluster
// is built now and the two 4.3 specs that entered through this page (composer-open-close,
// task-complete-ui) also go live at this L4 gate.
//
// Element driving mirrors the proven @l3/@l4 pattern: Playwright fill()/click()/press() are
// teleported to the app's bindinput/bindtap/bindconfirm across the <lynx-view> shadow DOM; route
// assertions read the memory router through the __dooeyRouter worker bridge (no address bar).

/** Reach a signed-in shell by seeding the session across the R11 storage seam (the proven path:
 * write the AsyncAuthStore payload into the host page's localStorage, reload, let the app hydrate).
 * Async hydration can transit /login first, so poll for the settled guarded index. */
async function signInAndLand(page: Page, pb: PocketBase): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
}

test.describe('Today / Planner @l4', () => {
  test('@l4 today-quickadd-realtime: the quick-add stamp files a task that appears live and persists', async ({
    page,
    pb,
  }) => {
    await signInAndLand(page, pb)

    // The Today page has landed: its quick-add stamp is the in-app entry point.
    await expect(page.getByTestId('quick-add')).toBeVisible()

    // A unique title so the row assertion never collides with another spec's records.
    const title = `Quick add ${Date.now()}`

    // Tap the stamp -> the ComposerSheet slides up focused on the title input (SPEC 7 flow).
    await page.getByTestId('quick-add').click()
    await expect(page.getByTestId('composer-sheet')).toBeVisible()

    const titleInput = page.getByTestId('composer-title').locator('input')
    await titleInput.fill(title)
    // Wait for the title to propagate to the worker's React state (the Add button un-disables),
    // so the Enter-confirm reads a non-empty title, then confirm (bindconfirm -> submit()).
    await expect(page.getByTestId('composer-submit')).toHaveCSS('opacity', '1')
    await titleInput.press('Enter')

    // REALTIME: the row shows in the day sheet with NO reload (create -> cache invalidation ->
    // useDayTasks refetch, plus the useTasksLive SSE follow).
    const row = page.getByTestId('agenda-row').filter({ hasText: title })
    await expect(row).toBeVisible({ timeout: 20_000 })

    // ...and it actually persisted to PocketBase (an undated open task, so it files under today).
    await expect
      .poll(
        () =>
          pb
            .collection('tasks')
            .getFullList({ filter: pb.filter('title = {:t}', { t: title }) })
            .then((rs) => rs.length),
        { timeout: 20_000 },
      )
      .toBe(1)

    // Survives a reload (memory history restarts at "/"): the row re-fetches and re-displays.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await expect(page.getByTestId('agenda-row').filter({ hasText: title })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('@l4 today-signedout: a signed-out visit to "/" is held at the login front door', async ({
    page,
  }) => {
    // No session seeded. The L3 `app` guard redirects an invalid session to /login BEFORE the
    // Today page mounts, so the ported SignedOut ("Your day, kept.") panel is not reachable on the
    // web target (it is kept for shape parity / unguarded hosts). The honest, non-faked assertion
    // of the signed-out state at "/" is therefore the guard redirect + the planner content being
    // withheld - never a rendered panel the guard supersedes.
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // The login front door renders and the router settled on /login (guard redirect).
    await expect(page.getByTestId('login-wordmark')).toBeVisible()
    await expect(page.getByTestId('login-wordmark')).toContainText('DOOEY')
    await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/login')

    // Protected planner content (this unit's quick-add stamp) is not served to a signed-out visitor.
    await expect(page.getByTestId('quick-add')).toHaveCount(0)
  })
})
