import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'
import type { E2ECreds } from './pb-env'

// L5-calendar Google-events suite (unit 5.3). Proves the read-only calendar_events RENDER path on
// the real Lynx web output + disposable PocketBase: a superuser-seeded event interleaves with a
// dated task in Today (ordered by time), and renders in the week view in today's column at the
// right slot with the foreign (blue) accent, as a NON-draggable block.
//
// SEEDING CRUX (DONE MEANS #5): calendar_events has createRule=null (server-only, written by
// pb_hooks/calendar-sync.js). An app user CANNOT create one via the SDK (would 403). The fixture
// therefore seeds it as a SUPERUSER (superusers bypass API rules), with `user` = the test app user
// so listRule ("user = @request.auth.id") lets the signed-in app read it. The task partner is
// seeded normally as the app user. The server hook is never exercised here; we write the row
// directly (no Google, no OAuth, no tokens - those are PARKED and out of bounds).
//
// Determinism (mirrors 5.1/5.2): the app's localDate()/grid math reads the BROWSER (web-worker)
// timezone, so the context timezoneId is pinned to UTC and the seed's UTC instants are chosen to
// fall on TODAY at a known local time. (The users collection has no `timezone` field in this
// schema, so the browser tz is the only lever.) Route assertions go through the __dooeyRouter
// worker bridge; data-testids / data-* attributes survive into the shadow DOM.

test.use({ timezoneId: 'UTC' })

const TASK_TITLE = 'L5 task block'
const TASK_START = 600 // 10:00 local, minutes from midnight
const EVENT_TITLE = 'L5 seed event'
const EVENT_EXTID = 'l5-evt-1'
const EVENT_START_MIN = 840 // 14:00 local (start_at 14:00Z under timezoneId=UTC)
const DAY_START = 360 // 6:00 (timeGrid.DAY_START)
const PX = 1 // week/day open at PX_DEFAULT = 1 (60px/hour)
// Week block top in px: (startMin - DAY_START) * px = (840 - 360) * 1.
const EXPECTED_TOP = String((EVENT_START_MIN - DAY_START) * PX)

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

/** Open the calendar space (default = week view) via the memory-history bridge. */
async function openCalendar(page: Page): Promise<void> {
  await navigateVia(page, '/calendar')
  await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/calendar')
  await expect(page.getByTestId('page-calendar')).toBeVisible()
}

/** A superuser SDK client against the disposable PB (superusers bypass the null createRule). */
async function superuser(creds: E2ECreds): Promise<PocketBase> {
  const su = new PocketBase(creds.pbUrl)
  su.autoCancellation(false)
  await su.collection('_superusers').authWithPassword(creds.superuser.email, creds.superuser.password)
  return su
}

test.describe('Google Calendar events @l5', () => {
  // Seed ONE dated task (10:00, app user) + ONE Google event (14:00, superuser) on today (UTC).
  // Idempotent: find-or-create, so the two tests share the seed without tripping the UNIQUE
  // (user, external_id) index or accumulating duplicates (workers=1, fresh disposable PB per run).
  test.beforeEach(async ({ pb, creds }) => {
    const existingTask = await pb
      .collection('tasks')
      .getFullList({ filter: pb.filter('title = {:t}', { t: TASK_TITLE }) })
    if (existingTask.length === 0) {
      await pb.collection('tasks').create({
        owner: pb.authStore.record!.id,
        title: TASK_TITLE,
        due_date: `${todayUTC()} 00:00:00.000Z`,
        start_min: TASK_START,
        dur_min: 60,
        sort_order: TASK_START, // agenda orders by sort_order; keep the task ahead of the 14:00 event
      })
    }

    const su = await superuser(creds)
    const existingEvt = await su
      .collection('calendar_events')
      .getFullList({ filter: su.filter('external_id = {:e}', { e: EVENT_EXTID }) })
    if (existingEvt.length === 0) {
      await su.collection('calendar_events').create({
        user: creds.user.id, // MUST be the test app user so listRule lets the app read it
        external_id: EVENT_EXTID,
        title: EVENT_TITLE,
        calendar_id: 'primary',
        start_at: `${todayUTC()}T14:00:00.000Z`,
        end_at: `${todayUTC()}T15:00:00.000Z`,
      })
    }
    su.authStore.clear()
  })

  test('@l5 a seeded Google event appears in Today interleaved with dated tasks', async ({
    page,
    pb,
  }) => {
    await signInAndLand(page, pb)

    // "/" is the Planner; the agenda sheet lists the day's tasks with the foreign events folded in.
    const agenda = page.getByTestId('agenda-sheet')
    await expect(agenda).toBeVisible()
    await expect(agenda.getByText(TASK_TITLE).first()).toBeVisible({ timeout: 20_000 })
    await expect(agenda.getByText(EVENT_TITLE).first()).toBeVisible({ timeout: 20_000 })

    // Interleaved by time: the 10:00 task row precedes the 14:00 event row in the list.
    const rowTexts = await agenda.getByTestId('agenda-row').allTextContents()
    const taskIdx = rowTexts.findIndex((t) => t.includes(TASK_TITLE))
    const eventIdx = rowTexts.findIndex((t) => t.includes(EVENT_TITLE))
    expect(taskIdx).toBeGreaterThanOrEqual(0)
    expect(eventIdx).toBeGreaterThan(taskIdx)
  })

  test('@l5 the seeded event appears in the week view in the correct slot', async ({ page, pb }) => {
    const calReqs: string[] = []
    page.on('response', async (r) => {
      if (r.url().includes('calendar_events')) {
        calReqs.push(`${r.status()} ${r.url()} :: ${(await r.text().catch(() => '')).slice(0, 300)}`)
      }
    })
    await signInAndLand(page, pb)
    await openCalendar(page)
    await page.waitForTimeout(3000)
    console.log('CAL_EVENTS_REQUESTS:\n' + calReqs.join('\n'))

    // Default view is the week spread. The event renders as a read-only WeekSessionBlock.
    const evt = page.getByTestId('week-session').filter({ hasText: EVENT_TITLE }).first()
    await expect(evt).toBeVisible({ timeout: 20_000 })
    // Today's column ...
    await expect(evt).toHaveAttribute('data-day', todayUTC())
    // ... at the correct slot: top = (startMin - DAY_START) * px = (840 - 360) * 1.
    await expect(evt).toHaveAttribute('data-top', EXPECTED_TOP)
    // ... visually distinct: the foreign (blue) accent, not the task zest.
    await expect(evt).toHaveAttribute('data-accent', 'bg-sky')

    // NOT draggable (R9-honest, no faked gesture): the event took the read-only WeekSessionBlock
    // path, which has NO main-thread:bindtouch* drag worklets, and never renders as the draggable
    // task week-block. (calendar_events write rules are null anyway, so no drag could persist.)
    await expect(page.getByTestId('week-block').filter({ hasText: EVENT_TITLE })).toHaveCount(0)
  })
})
