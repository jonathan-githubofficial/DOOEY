import type { Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'

// L4-tasks task-page suite (unit 4.2). Proves the ported `/task/$id` page on the real Lynx web
// output + disposable PocketBase: a task opens to its own page showing its title; editing Notes
// autosaves and the note survives a reload; a checklist item can be added and toggled done, and
// that state persists across a reload (via the `checklist` JSON).
//
// Memory history has no address bar, so navigation + route assertions go through the __dooeyRouter
// worker bridge (router-bridge.ts) - here with a dynamic route template + params, since unit 4.1's
// Today page (the in-app entry to a task) is not built yet (L4 land order R4: 4.2 -> 4.3 -> 4.1).
// Element driving is the pattern the @l3 auth suite verified: Playwright fill()/click()/press()
// reach the Lynx element handlers (a native `input`/`blur`/form-`submit`/`click` is teleported to
// the app's bindinput/bindblur/bindconfirm/bindtap). Content assertions read data-testids that
// survive into the <lynx-view> shadow DOM; persistence is confirmed against the PB record too.

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

/** Open a task page by driving the memory router to its dynamic route. */
async function openTask(page: Page, id: string): Promise<void> {
  await navigateVia(page, '/task/$id', { id })
  await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe(`/task/${id}`)
  await expect(page.getByTestId('task-detail')).toBeVisible()
}

test.describe('Task page @l4', () => {
  test('@l4 task-open: opening a task lands on its page and shows the title', async ({
    page,
    pb,
  }) => {
    const rec = await pb
      .collection('tasks')
      .create({ owner: pb.authStore.record!.id, title: 'Ship the Lynx port' })

    await signInAndLand(page, pb)
    await openTask(page, rec.id)

    await expect(page.getByTestId('task-title')).toContainText('Ship the Lynx port')
  })

  test('@l4 task-notes-persist: typing a note autosaves and survives a reload', async ({
    page,
    pb,
  }) => {
    const rec = await pb
      .collection('tasks')
      .create({ owner: pb.authStore.record!.id, title: 'Errands' })

    await signInAndLand(page, pb)
    await openTask(page, rec.id)

    // Notes is empty, so it hides behind the add-affordance; open it, then type + flush (Enter).
    await page.getByTestId('add-notes').click()
    const notes = page.getByTestId('task-notes-input').locator('input')
    await expect(notes).toBeVisible()
    await notes.fill('Buy oat milk on the way home')
    await notes.press('Enter')

    // Autosave flushed -> the PB record carries the note.
    await expect
      .poll(() => pb.collection('tasks').getOne(rec.id).then((r) => r.notes), { timeout: 20_000 })
      .toBe('Buy oat milk on the way home')

    // Reload (memory history restarts at "/"), re-open the task: the saved note re-displays.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await openTask(page, rec.id)
    await expect(page.getByTestId('task-notes-input').locator('input')).toHaveValue(
      'Buy oat milk on the way home',
    )
  })

  test('@l4 task-checklist-toggle: add + toggle a checklist item, persisted across reload', async ({
    page,
    pb,
  }) => {
    const rec = await pb
      .collection('tasks')
      .create({ owner: pb.authStore.record!.id, title: 'Trip prep' })

    await signInAndLand(page, pb)
    await openTask(page, rec.id)

    // Open the checklist section and add an item (Enter = bindconfirm).
    await page.getByTestId('add-checklist').click()
    const addInput = page.getByTestId('checklist-add').locator('input')
    await expect(addInput).toBeVisible()
    await addInput.fill('Pack the charger')
    await addInput.press('Enter')

    await expect
      .poll(() => pb.collection('tasks').getOne(rec.id).then((r) => (r.checklist ?? []).length), {
        timeout: 20_000,
      })
      .toBe(1)
    await expect(page.getByTestId('checklist-item')).toHaveCount(1)
    await expect(page.getByTestId('checklist-count')).toHaveText('0/1')

    // Toggle the item done (scoped to the checklist row, not the header Check).
    await page.getByTestId('checklist-item').getByTestId('check').click()
    await expect(page.getByTestId('checklist-count')).toHaveText('1/1')
    await expect
      .poll(
        () => pb.collection('tasks').getOne(rec.id).then((r) => (r.checklist ?? [])[0]?.done === true),
        { timeout: 20_000 },
      )
      .toBe(true)

    // Survives a reload (persisted via the `checklist` JSON).
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await openTask(page, rec.id)
    await expect(page.getByTestId('checklist-count')).toHaveText('1/1')
    await expect(page.getByTestId('checklist-item').getByTestId('check')).toHaveAttribute(
      'data-done',
      'true',
    )
  })
})
