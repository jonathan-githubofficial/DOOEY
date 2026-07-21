import type { CDPSession, Page } from '@playwright/test'
import PocketBase from 'pocketbase'

import { test, expect } from './fixtures'
import { navigateVia, routerPathname } from './router-bridge'

// L7-doodles avatar suite (unit 7.3's shared pad, wired into auth's AvatarDoodle). Proves freehand
// CAPTURE on the real Lynx web output: a synthetic touch stroke on the DoodleEditor pad (a) grows
// the LIVE <svg content> mid-gesture inside the main-thread worklet (the #290 risk, happy branch),
// (b) commits a percent-space Stroke on release, and (c) persists to users.avatar_doodle on save
// and re-renders after a full reload. Touch recipe = 5.2's (spike finding 6): CDP
// Input.dispatchTouchEvent into a touch-capable context; page.mouse does not reach the touch host.

test.use({ timezoneId: 'UTC', hasTouch: true, isMobile: true, viewport: { width: 480, height: 900 } })

interface StrokeRec {
  color: string
  points: [number, number][]
}

/** Sign in across the R11 storage seam (write pb_auth, reload, let the app hydrate), then settle. */
async function signInAndLand(page: Page, pb: PocketBase): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
}

/** Open Account and the doodle editor, and wait for the pad to be measurable (the editor's
 * `.animate-enter` rise is 360ms; the pad rect is re-measured on animationend). */
async function openEditor(page: Page): Promise<void> {
  await navigateVia(page, '/account')
  await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/account')
  await page.getByTestId('avatar-doodle').click()
  await expect(page.getByTestId('doodle-editor')).toBeVisible()
  await page.waitForTimeout(500)
}

/** Synthesize a touch stroke across the pad via CDP; returns after touchEnd. `checkpoint` runs
 * mid-gesture (after the moves, before the release) so specs can assert the LIVE preview. */
async function strokeOnPad(
  page: Page,
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  checkpoint?: () => Promise<void>,
  steps = 10,
): Promise<void> {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
      ],
    })
    await page.waitForTimeout(16)
  }
  if (checkpoint) await checkpoint()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('Avatar doodle @l7', () => {
  // Reset the avatar each run so the tests are order-independent (workers=1, disposable PB).
  test.beforeEach(async ({ pb }) => {
    await pb.collection('users').update(pb.authStore.record!.id, { avatar_doodle: [] })
  })

  test('@l7 a freehand stroke live-previews, saves to users.avatar_doodle and re-renders after reload', async ({
    page,
    pb,
  }) => {
    await signInAndLand(page, pb)
    await openEditor(page)

    const pad = page.getByTestId('doodle-capture')
    const box = await pad.boundingBox()
    if (!box) throw new Error('doodle pad has no bounding box')
    const cdp = await page.context().newCDPSession(page)

    // Diagonal stroke across the pad; mid-gesture the live <svg content> must contain a grown
    // path (M ... L ...) — the incremental main-thread setAttribute("content") repaint.
    await strokeOnPad(
      page,
      cdp,
      { x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 },
      { x: box.x + box.width * 0.8, y: box.y + box.height * 0.7 },
      async () => {
        await expect(page.getByTestId('doodle-live')).toHaveAttribute('content', /d="M [\d. ]+ L /, {
          timeout: 5_000,
        })
      },
    )

    // On release the live layer clears and the stroke is committed to the pad's own renderer.
    await expect(page.getByTestId('doodle-live')).not.toHaveAttribute('content', / L /, {
      timeout: 10_000,
    })

    // Save -> users.avatar_doodle holds one percent-space stroke with an ink token colour.
    await page.getByTestId('doodle-tool-save').click()
    await expect
      .poll(
        async () => {
          const rec = await pb.collection('users').getOne(pb.authStore.record!.id)
          return ((rec.avatar_doodle as StrokeRec[] | null) ?? []).length
        },
        { timeout: 20_000 },
      )
      .toBe(1)
    const rec = await pb.collection('users').getOne(pb.authStore.record!.id)
    const stroke = (rec.avatar_doodle as StrokeRec[])[0]
    expect(stroke.points.length).toBeGreaterThan(1)
    expect(['ink', 'zest', 'sky', 'clay']).toContain(stroke.color)
    for (const [x, y] of stroke.points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(100)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(100)
    }

    // The editor closed on save, and the saved doodle re-renders after a full reload (from PB,
    // not optimistic state): the avatar wears a percent-viewBox DoodleSvg, not the pencil glyph.
    await expect(page.getByTestId('doodle-editor')).toHaveCount(0)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
    await navigateVia(page, '/account')
    await expect(page.getByTestId('avatar-doodle').locator('x-svg')).toHaveAttribute(
      'content',
      /viewBox="0 0 100 100"[\s\S]* L /,
      { timeout: 20_000 },
    )
  })

  test('@l7 the eraser splits a stroke and save persists the split', async ({ page, pb }) => {
    await signInAndLand(page, pb)
    await openEditor(page)

    const pad = page.getByTestId('doodle-capture')
    const box = await pad.boundingBox()
    if (!box) throw new Error('doodle pad has no bounding box')
    const cdp = await page.context().newCDPSession(page)

    // One horizontal stroke across the middle...
    await strokeOnPad(
      page,
      cdp,
      { x: box.x + box.width * 0.1, y: box.y + box.height * 0.5 },
      { x: box.x + box.width * 0.9, y: box.y + box.height * 0.5 },
    )
    // ...then an eraser drag vertically through its centre splits it in two.
    await page.getByTestId('doodle-tool-eraser').click()
    await strokeOnPad(
      page,
      cdp,
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.2 },
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.8 },
    )

    await page.getByTestId('doodle-tool-save').click()
    await expect
      .poll(
        async () => {
          const rec = await pb.collection('users').getOne(pb.authStore.record!.id)
          return ((rec.avatar_doodle as StrokeRec[] | null) ?? []).length
        },
        { timeout: 20_000 },
      )
      .toBe(2)
  })
})
