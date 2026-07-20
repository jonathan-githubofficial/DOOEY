import type { CDPSession, Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'

// L5-calendar timebox-drag suite (unit 5.2). Proves the Main-Thread Scripting (MTS) drag gesture on
// the real Lynx web output + disposable PocketBase: a downward touch-drag on a day-view block moves
// it to a later slot and PERSISTS the new start_min to PB, and an upward drag off the top of the
// sheet unschedules it (start_min -> 0). This is the R9 oracle: it drives REAL synthetic touch into
// the main-thread:bindtouch* worklets. If synthetic touch could not reach the worklets (drag = no
// movement, no persistence), this unit returns BLOCKED per DONE MEANS #5 -- never a faked green.
//
// Touch recipe (Phase-0 spike finding 6, verified GO): a touch-capable context + a CDP session
// driving Input.dispatchTouchEvent (touchStart -> N x touchMove -> touchEnd). page.mouse alone does
// NOT reach the touch host. Coords are viewport CSS px from the element's on-screen rect (Playwright
// locators pierce the <lynx-view> shadow DOM, so locator.boundingBox() gives the rect directly).
//
// Determinism mirrors 5.1: timezone pinned to UTC so the app's localDate()/grid math matches the
// seed's UTC due day. Route assertions go through the __dooeyRouter worker bridge.

test.use({ timezoneId: 'UTC', hasTouch: true, isMobile: true, viewport: { width: 480, height: 900 } })

const SEED_TITLE = 'L5 drag block'
const SEED_START = 600 // 10:00, minutes from midnight
const SEED_DUR = 60
const PX = 1 // day view opens at PX_DEFAULT = 1 (60px/hour); (start - DAY_START) * px = top in px
const DAY_START = 360 // 6:00 (timeGrid.DAY_START)

/** Today's date as YYYY-MM-DD in UTC (matches the app's localDate() under timezoneId='UTC'). */
function todayUTC(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

/** Sign in across the R11 storage seam (write pb_auth, reload, let the app hydrate), then settle. */
async function signInAndLand(page: Page, pb: PocketBase): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
}

/** Open the calendar and switch to the day view (selected defaults to today = the seeded day). */
async function openDayView(page: Page): Promise<void> {
  await navigateVia(page, '/calendar')
  await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/calendar')
  await expect(page.getByTestId('page-calendar')).toBeVisible()
  await page.getByTestId('view-day').click()
  await expect(page.getByTestId('timebox-sheet')).toBeVisible()
}

/** Synthesize a real touch drag from (x0,y0) by (dx,dy) via CDP (the only input the Lynx web host
 * forwards into main-thread:bindtouch* worklets). */
async function touchDrag(
  page: Page,
  cdp: CDPSession,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
  steps = 12,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps }],
    })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('Timebox drag @l5', () => {
  // Seed/reset ONE dated task on today (UTC) to a canonical 10:00/60m each run, so the tests are
  // order-independent (workers=1, fresh disposable PB per run).
  test.beforeEach(async ({ pb }) => {
    const existing = await pb
      .collection('tasks')
      .getFullList({ filter: pb.filter('title = {:t}', { t: SEED_TITLE }) })
    const data = {
      owner: pb.authStore.record!.id,
      title: SEED_TITLE,
      due_date: `${todayUTC()} 00:00:00.000Z`,
      start_min: SEED_START,
      dur_min: SEED_DUR,
      done_at: '',
    }
    if (existing.length === 0) await pb.collection('tasks').create(data)
    else await pb.collection('tasks').update(existing[0].id, data)
  })

  test('@l5 dragging a timebox block moves it to a later slot and persists', async ({ page, pb }) => {
    await signInAndLand(page, pb)
    await openDayView(page)

    const block = page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE }).first()
    await expect(block).toBeVisible({ timeout: 20_000 })
    // Opens at the seeded slot: top = (600 - 360) * 1 = 240.
    await expect(block).toHaveAttribute('data-top', String((SEED_START - DAY_START) * PX))

    // Drag DOWN 120px -> +120 min -> 12:00 (start_min 720). Grab the block's centre.
    const box = await block.boundingBox()
    if (!box) throw new Error('block has no bounding box')
    const cdp = await page.context().newCDPSession(page)
    await touchDrag(page, cdp, box.x + box.width / 2, box.y + box.height / 2, 0, 120 * PX)

    // The block re-renders at the committed slot: top = (720 - 360) * 1 = 360.
    await expect(block).toHaveAttribute('data-top', String((720 - DAY_START) * PX), { timeout: 20_000 })

    // Persistence: the PB record itself moved to 12:00 (proves the runOnBackground commit landed).
    await expect
      .poll(
        async () => {
          const rec = await pb
            .collection('tasks')
            .getFirstListItem(pb.filter('title = {:t}', { t: SEED_TITLE }))
          return rec.start_min
        },
        { timeout: 20_000 },
      )
      .toBe(720)

    // And it survives a reload (re-hydrated from PB, not just optimistic cache).
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await openDayView(page)
    const reloaded = page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE }).first()
    await expect(reloaded).toHaveAttribute('data-top', String((720 - DAY_START) * PX), { timeout: 20_000 })
  })

  test('@l5 dragging a block above the sheet unschedules it', async ({ page, pb }) => {
    await signInAndLand(page, pb)
    await openDayView(page)

    const block = page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE }).first()
    await expect(block).toBeVisible({ timeout: 20_000 })

    // Drag UP well past the top of the sheet (raw start < DAY_START - 20 => "off" => unschedule).
    const box = await block.boundingBox()
    if (!box) throw new Error('block has no bounding box')
    const cdp = await page.context().newCDPSession(page)
    await touchDrag(page, cdp, box.x + box.width / 2, box.y + box.height / 2, 0, -300 * PX)

    // Persistence: start_min back to 0 (unscheduled) in PB.
    await expect
      .poll(
        async () => {
          const rec = await pb
            .collection('tasks')
            .getFirstListItem(pb.filter('title = {:t}', { t: SEED_TITLE }))
          return rec.start_min
        },
        { timeout: 20_000 },
      )
      .toBe(0)

    // After a reload it is off the timed grid and back on the shelf.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await openDayView(page)
    await expect(
      page.getByTestId('timebox-shelf-chip').filter({ hasText: SEED_TITLE }).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE })).toHaveCount(0)
  })
})
