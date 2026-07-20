import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'

// L5-calendar views suite (unit 5.1). Proves the ported Calendar space + the restored Today date
// shelf on the real Lynx web output + disposable PocketBase: a seeded dated task renders in the
// right week column + time slot, shows a dot on its month-grid day, and mounts in the day timebox
// sheet; and Today's WeekStrip ribbon is back (the 4.1 -> 5.1 shelf restoration).
//
// Determinism: the app's localDate()/day-grid math reads the BROWSER (web-worker) timezone, so the
// context timezoneId is pinned to UTC and the seed's due day is computed in UTC to match. (The
// users collection has no `timezone` field in this schema, and lib/format.ts has no call sites, so
// the browser tz is the only lever - no user field to set.)
//
// Element driving mirrors the proven @l3/@l4 pattern: Playwright click() is teleported to the app's
// bindtap across the <lynx-view> shadow DOM; route assertions read the memory router through the
// __dooeyRouter worker bridge; data-testids / data-* attributes survive into the shadow DOM.

test.use({ timezoneId: 'UTC' })

const SEED_TITLE = 'L5 seed block'
const SEED_START = 600 // 10:00, minutes from midnight
const SEED_DUR = 60
// The block's top offset in px at PX_DEFAULT (=1): (start - DAY_START) * px = (600 - 360) * 1.
const EXPECTED_TOP = '240'

/** Today's date as YYYY-MM-DD in UTC (matches the app's localDate() under timezoneId='UTC'). */
function todayUTC(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

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

/** Open the calendar space via the memory-history bridge and wait for the page to mount. */
async function openCalendar(page: Page): Promise<void> {
  await navigateVia(page, '/calendar')
  await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/calendar')
  await expect(page.getByTestId('page-calendar')).toBeVisible()
}

test.describe('Calendar views @l5', () => {
  // Seed exactly ONE dated task on today (UTC): start 10:00, 60m. Idempotent so the four tests
  // share it without accumulating duplicates (workers=1, fresh disposable PB per run).
  test.beforeEach(async ({ pb }) => {
    const existing = await pb
      .collection('tasks')
      .getFullList({ filter: pb.filter('title = {:t}', { t: SEED_TITLE }) })
    if (existing.length === 0) {
      await pb.collection('tasks').create({
        owner: pb.authStore.record!.id,
        title: SEED_TITLE,
        due_date: `${todayUTC()} 00:00:00.000Z`,
        start_min: SEED_START,
        dur_min: SEED_DUR,
      })
    }
  })

  test('@l5 week view renders a seeded dated task in the correct day column and time slot', async ({
    page,
    pb,
  }) => {
    await signInAndLand(page, pb)
    await openCalendar(page)

    // Default view is the week spread. The seeded block shows in its day column at the right slot.
    const block = page.getByTestId('week-block').filter({ hasText: SEED_TITLE }).first()
    await expect(block).toBeVisible({ timeout: 20_000 })
    // Correct day column (the block is rendered inside its day's WeekColumn) ...
    await expect(block).toHaveAttribute('data-day', todayUTC())
    // ... and the correct time slot: top = (start_min - DAY_START) * px.
    await expect(block).toHaveAttribute('data-top', EXPECTED_TOP)
  })

  test('@l5 month view shows the seeded task day with an open-task dot', async ({ page, pb }) => {
    await signInAndLand(page, pb)
    await openCalendar(page)

    await page.getByTestId('view-month').click()
    await expect(page.getByTestId('month-view')).toBeVisible()

    // The seeded day's cell carries at least one zest open-task dot.
    const cell = page.locator(`[data-testid="month-cell"][data-day="${todayUTC()}"]`)
    await expect(cell).toBeVisible()
    await expect(cell.getByTestId('month-task-dot').first()).toBeVisible({ timeout: 20_000 })
  })

  test('@l5 day view mounts the timebox sheet for the selected day', async ({ page, pb }) => {
    await signInAndLand(page, pb)
    await openCalendar(page)

    // Switch to the day view; `selected` defaults to today (= the seeded day).
    await page.getByTestId('view-day').click()
    const sheet = page.getByTestId('timebox-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText(SEED_TITLE).first()).toBeVisible({ timeout: 20_000 })
  })

  test('@l5 Today shows the restored week date shelf', async ({ page, pb }) => {
    await signInAndLand(page, pb)

    // "/" is the Planner: the restored WeekStrip ribbon renders its seven day chips (4.1 -> 5.1).
    await expect(page.getByTestId('week-strip')).toBeVisible()
    await expect(page.getByTestId('week-strip-day')).toHaveCount(7)
  })
})
