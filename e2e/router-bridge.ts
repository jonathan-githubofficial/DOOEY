import type { Page, Worker } from '@playwright/test'

// Unit 3.1 E2E router bridge access.
//
// The Lynx app runs in a Web Worker (@lynx-js/web-core spins up web-core-worker-chunk.js), so
// the TanStack Router - and its `__dooeyRouter` E2E bridge (src/router.tsx, gated on
// PUBLIC_DOOEY_E2E) - lives on the WORKER global, NOT the page/main-thread window. Verified in
// this run: `page.evaluate(() => globalThis.__dooeyRouter)` is undefined, while the web-core
// worker exposes the router. Memory history has no address bar, so specs drive navigation and
// read the current route through this bridge, reached via `page.workers()`. A reload respawns
// the worker, so the worker is re-resolved on every call.

interface RouterBridge {
  navigate(opts: { to: string }): Promise<unknown>
  state: { location: { pathname: string } }
}
type WithBridge = { __dooeyRouter?: RouterBridge }

/** Poll the page's workers for the one exposing `__dooeyRouter` (appears once router.tsx runs
 * in the web-core worker; re-resolved after each reload). Throws if never found. */
async function routerWorker(page: Page, timeout = 20_000): Promise<Worker> {
  const deadline = Date.now() + timeout
  let lastErr = 'no workers attached'
  while (Date.now() < deadline) {
    for (const w of page.workers()) {
      const has = await w
        .evaluate(() => typeof (globalThis as unknown as WithBridge).__dooeyRouter !== 'undefined')
        .catch((e: Error) => {
          lastErr = e.message
          return false
        })
      if (has) return w
    }
    await page.waitForTimeout(150)
  }
  throw new Error(`__dooeyRouter bridge worker not found within ${timeout}ms (last: ${lastErr})`)
}

/** Navigate the memory-history router to `to` and wait for the navigation to settle. */
export async function navigateVia(page: Page, to: string): Promise<void> {
  const w = await routerWorker(page)
  await w.evaluate(async (dest) => {
    await (globalThis as unknown as WithBridge).__dooeyRouter?.navigate({ to: dest })
  }, to)
}

/** The router's current pathname (memory history: pathname + search, no address bar). */
export async function routerPathname(page: Page): Promise<string> {
  const w = await routerWorker(page)
  return w.evaluate(
    () => (globalThis as unknown as WithBridge).__dooeyRouter?.state.location.pathname ?? '',
  )
}
