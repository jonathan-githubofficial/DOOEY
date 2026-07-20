import { test, expect } from './fixtures'

// The @l1 smoke spec - the run's first live tag and its foundational success oracle.
// It proves, end to end in headless Chromium against the disposable PocketBase, that:
//   a) the built Lynx web output BOOTS and renders the signed-out status surface (proving the
//      R11 fix: the web-worker app boots with no window/document/localStorage crash);
//   b) a PROGRAMMATIC sign-in (no login UI) flips the surface to signed-in - the token is
//      written ONCE into the host page's localStorage (the R11 NativeStorageModule backing) and
//      the app's AsyncAuthStore hydrates it asynchronously through the storage seam;
//   c) a record created via the PB API appears LIVE (SSE) without a reload - useCollectionLive
//      + the platform EventSource delivering the realtime event (PLAN 5.4 key spike);
//   d) a page RELOAD retains the session (R11's whole point) - it is re-read from main-thread
//      localStorage via the seam, NOT re-injected by the test.
//
// The Lynx app renders inside a <lynx-view> shadow DOM; element ids survive to DOM nodes
// (x-text, x-view), so we deep-query through shadow roots. An open PB subscription keeps the
// SSE socket open, so we navigate with 'domcontentloaded', never 'networkidle' (spike caveat).

/** Concatenated textContent across every (nested) shadow root - for coarse surface asserts. */
async function deepText(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const acc: string[] = []
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walk(el.shadowRoot)
      })
      acc.push(root.textContent ?? '')
    }
    walk(document)
    return acc.join(' | ')
  })
}

/** Read a single element's text by id, deep through shadow roots (null if absent). */
async function readById(page: import('@playwright/test').Page, id: string): Promise<string | null> {
  return page.evaluate((wantId) => {
    let out: string | null = null
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll('*').forEach((el) => {
        if (el.id === wantId) out = el.textContent
        if (el.shadowRoot) walk(el.shadowRoot)
      })
    }
    walk(document)
    return out
  }, id)
}

/** Parse the live task count off the surface ("tasks: N"); -1 while loading/absent. */
async function readTaskCount(page: import('@playwright/test').Page): Promise<number> {
  const text = await readById(page, 'task-count')
  const m = text?.match(/tasks:\s*(\d+)/)
  return m ? Number.parseInt(m[1], 10) : -1
}

test('app boots, programmatic sign-in, and a PB-API record raises the live count via SSE @l1', async ({
  page,
  pb,
}) => {
  // a) BOOT - signed-out surface renders from the built web output.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => deepText(page), { timeout: 20_000 }).toContain('DOOEY')
  await expect.poll(() => deepText(page), { timeout: 20_000 }).toContain('signed out')

  // b) PROGRAMMATIC SIGN-IN - write the token obtained Node-side into the host page's
  //    localStorage ONCE (page.evaluate, NOT addInitScript, so a later reload proves genuine
  //    persistence rather than re-injection), then reload so lib/pb.ts's AsyncAuthStore hydrates
  //    it asynchronously across the storage seam. The serialized shape is exactly what
  //    AsyncAuthStore.save writes.
  const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => deepText(page), { timeout: 20_000 }).toContain('signed in')

  // c) LIVE SSE PROOF - the surface shows the count; create a task via the PB API (as the
  //    signed-in user) and assert the count rises WITHOUT a manual reload.
  await expect.poll(() => readTaskCount(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(0)
  const before = await readTaskCount(page)

  await pb.collection('tasks').create({
    owner: pb.authStore.record?.id,
    title: `sse-roundtrip-${Date.now()}`,
  })

  await expect
    .poll(() => readTaskCount(page), { timeout: 20_000 })
    .toBeGreaterThan(before)

  // d) RELOAD PERSISTENCE (R11) - reload WITHOUT re-seeding. The session must survive because it
  //    lives in the host page's localStorage via the storage seam, so the app re-hydrates it.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => deepText(page), { timeout: 20_000 }).toContain('signed in')
})
