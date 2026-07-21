import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'

// L4-tasks interactions + sheets suite (unit 4.3). Proves the ported due-date control end-to-end,
// and (once unit 4.1's Today page lands) the composer sheet open/close + task completion via the
// AgendaSheet, on the real Lynx web output + disposable PocketBase.
//
// LAND ORDER (ruling R4): the harness runs 4.2 -> 4.3 -> 4.1. Two of this unit's three specs enter
// the app through unit 4.1's Today page ("/") - the quick-add stamp (TaskComposer) and the day list
// (AgendaSheet) are mounted there. At 4.3's own gate that page is still the interim placeholder, so
// those two specs SKIP at runtime with a truthful reason and go live at the L4 gate once 4.1 lands
// (the story's DONE MEANS: "Full L4 buildability is validated at the L4 gate after 4.1+4.2 land").
// The due-date spec needs only unit 4.2's /task/$id page, so it runs fully now.
//
// CONTRACT for unit 4.1 (so the skipped specs activate): the Today quick-add stamp carries
// data-testid="quick-add" and mounts <ComposerSheet> (data-testid="composer-sheet"); the day list
// renders AgendaSheet rows (data-testid="agenda-row", each with a data-testid="check").

/** Reach a signed-in shell by seeding the session across the R11 storage seam (the proven path:
 * write the AsyncAuthStore payload into the host page's localStorage, reload, let the app hydrate). */
async function signInAndLand(page: Page, pb: PocketBase): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
}

/** Open a task page by driving the memory router to its dynamic route (unit 4.2 entry). */
async function openTask(page: Page, id: string): Promise<void> {
  await navigateVia(page, '/task/$id', { id })
  await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe(`/task/${id}`)
  await expect(page.getByTestId('task-detail')).toBeVisible()
}

/** True once unit 4.1's Today page (with the quick-add stamp) is mounted on "/". */
async function todayReady(page: Page): Promise<boolean> {
  return page
    .getByTestId('quick-add')
    .first()
    .waitFor({ state: 'visible', timeout: 4000 })
    .then(() => true)
    .catch(() => false)
}

/** Tomorrow's local YYYY-MM-DD and its "Mon D" label, matching dates.ts (localDate/addDays/dueInfo). */
function tomorrow(): { date: string; label: string } {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }
}

test.describe('Interactions + sheets @l4', () => {
  test('@l4 duedate-set: pick Tomorrow on a task page; the chip + record survive reload', async ({
    page,
    pb,
  }) => {
    const rec = await pb
      .collection('tasks')
      .create({ owner: pb.authStore.record!.id, title: 'Plan the week' })

    await signInAndLand(page, pb)
    await openTask(page, rec.id)

    // Open the pop-open due-date control and pick "Tomorrow".
    await page.getByTestId('task-due').click()
    await expect(page.getByTestId('due-popover')).toBeVisible()
    await page.getByTestId('due-quick-tomorrow').click()

    const { date, label } = tomorrow()
    // The chip now reads the tomorrow date...
    await expect(page.getByTestId('task-due')).toContainText(`due ${label}`)
    // ...and it persisted to the record (due_date is stored date-only at 00:00Z).
    await expect
      .poll(
        () => pb.collection('tasks').getOne(rec.id).then((r) => (r.due_date as string).slice(0, 10)),
        { timeout: 20_000 },
      )
      .toBe(date)

    // Survives a reload (memory history restarts at "/"): re-open the task, the chip still reads it.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await openTask(page, rec.id)
    await expect(page.getByTestId('task-due')).toContainText(`due ${label}`)
  })

  test('@l4 composer-open-close: the quick-add stamp opens the composer; backdrop closes it', async ({
    page,
    pb,
  }) => {
    await signInAndLand(page, pb)
    test.skip(
      !(await todayReady(page)),
      'Today page (unit 4.1) not landed yet - R4 land order 4.2 -> 4.3 -> 4.1; runs at the L4 gate',
    )

    await page.getByTestId('quick-add').first().click()
    await expect(page.getByTestId('composer-sheet')).toBeVisible()

    await page.getByTestId('composer-backdrop').click()
    await expect(page.getByTestId('composer-sheet')).toHaveCount(0, { timeout: 5000 })
  })

  test('@l4 task-complete-ui: checking a task row moves it to the done pile and persists', async ({
    page,
    pb,
  }) => {
    // An undated open task shows on Today's agenda (useDayTasks: today includes due_date = '').
    const rec = await pb
      .collection('tasks')
      .create({ owner: pb.authStore.record!.id, title: 'Water the plants' })

    await signInAndLand(page, pb)
    test.skip(
      !(await todayReady(page)),
      'Today page (unit 4.1) not landed yet - R4 land order 4.2 -> 4.3 -> 4.1; runs at the L4 gate',
    )

    const row = page.getByTestId('agenda-row').filter({ hasText: 'Water the plants' })
    await expect(row).toBeVisible()
    await row.getByTestId('check').click()

    // Completion persisted: done_at is set on the record.
    await expect
      .poll(() => pb.collection('tasks').getOne(rec.id).then((r) => !!r.done_at), { timeout: 20_000 })
      .toBe(true)
    // The open row is gone (it moved to the done pile).
    await expect(page.getByTestId('agenda-row').filter({ hasText: 'Water the plants' })).toHaveCount(0)

    // Survives a reload: still done.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await expect
      .poll(() => pb.collection('tasks').getOne(rec.id).then((r) => !!r.done_at), { timeout: 20_000 })
      .toBe(true)
  })
})
