# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timebox-drag.spec.ts >> Timebox drag @l5 >> @l5 dragging a timebox block moves it to a later slot and persists
- Location: e2e\timebox-drag.spec.ts:96:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByTestId('timebox-block').filter({ hasText: 'L5 drag block' }).first()
Expected: "360"
Received: "240"
Timeout:  20000ms

Call log:
  - Expect "toHaveAttribute" with timeout 20000ms
  - waiting for getByTestId('timebox-block').filter({ hasText: 'L5 drag block' }).first()
    43 × locator resolved to <x-view data-px="1" data-dur="60" data-top="240" data-start="600" data-id="rj3jkhhjal1lxr2" data-testid="timebox-block" class="grain absolute overflow-hidden rounded-xl border border-rule/70 bg-surface shadow-soft">…</x-view>
       - unexpected value "240"

```

```yaml
- text: L5 drag block 10a - 11a
```

# Test source

```ts
  12  | // movement, no persistence), this unit returns BLOCKED per DONE MEANS #5 -- never a faked green.
  13  | //
  14  | // Touch recipe (Phase-0 spike finding 6, verified GO): a touch-capable context + a CDP session
  15  | // driving Input.dispatchTouchEvent (touchStart -> N x touchMove -> touchEnd). page.mouse alone does
  16  | // NOT reach the touch host. Coords are viewport CSS px from the element's on-screen rect (Playwright
  17  | // locators pierce the <lynx-view> shadow DOM, so locator.boundingBox() gives the rect directly).
  18  | //
  19  | // Determinism mirrors 5.1: timezone pinned to UTC so the app's localDate()/grid math matches the
  20  | // seed's UTC due day. Route assertions go through the __dooeyRouter worker bridge.
  21  | 
  22  | test.use({ timezoneId: 'UTC', hasTouch: true, isMobile: true, viewport: { width: 480, height: 900 } })
  23  | 
  24  | const SEED_TITLE = 'L5 drag block'
  25  | const SEED_START = 600 // 10:00, minutes from midnight
  26  | const SEED_DUR = 60
  27  | const PX = 1 // day view opens at PX_DEFAULT = 1 (60px/hour); (start - DAY_START) * px = top in px
  28  | const DAY_START = 360 // 6:00 (timeGrid.DAY_START)
  29  | 
  30  | /** Today's date as YYYY-MM-DD in UTC (matches the app's localDate() under timezoneId='UTC'). */
  31  | function todayUTC(): string {
  32  |   const d = new Date()
  33  |   const p = (n: number) => String(n).padStart(2, '0')
  34  |   return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
  35  | }
  36  | 
  37  | /** Sign in across the R11 storage seam (write pb_auth, reload, let the app hydrate), then settle. */
  38  | async function signInAndLand(page: Page, pb: PocketBase): Promise<void> {
  39  |   await page.goto('/', { waitUntil: 'domcontentloaded' })
  40  |   const seed = JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record })
  41  |   await page.evaluate((val) => localStorage.setItem('pb_auth', val), seed)
  42  |   await page.reload({ waitUntil: 'domcontentloaded' })
  43  |   await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
  44  | }
  45  | 
  46  | /** Open the calendar and switch to the day view (selected defaults to today = the seeded day). */
  47  | async function openDayView(page: Page): Promise<void> {
  48  |   await navigateVia(page, '/calendar')
  49  |   await expect.poll(() => routerPathname(page), { timeout: 20_000 }).toBe('/calendar')
  50  |   await expect(page.getByTestId('page-calendar')).toBeVisible()
  51  |   await page.getByTestId('view-day').click()
  52  |   await expect(page.getByTestId('timebox-sheet')).toBeVisible()
  53  | }
  54  | 
  55  | /** Synthesize a real touch drag from (x0,y0) by (dx,dy) via CDP (the only input the Lynx web host
  56  |  * forwards into main-thread:bindtouch* worklets). */
  57  | async function touchDrag(
  58  |   page: Page,
  59  |   cdp: CDPSession,
  60  |   x0: number,
  61  |   y0: number,
  62  |   dx: number,
  63  |   dy: number,
  64  |   steps = 12,
  65  | ): Promise<void> {
  66  |   await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] })
  67  |   for (let i = 1; i <= steps; i++) {
  68  |     await cdp.send('Input.dispatchTouchEvent', {
  69  |       type: 'touchMove',
  70  |       touchPoints: [{ x: x0 + (dx * i) / steps, y: y0 + (dy * i) / steps }],
  71  |     })
  72  |     await page.waitForTimeout(16)
  73  |   }
  74  |   await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  75  | }
  76  | 
  77  | test.describe('Timebox drag @l5', () => {
  78  |   // Seed/reset ONE dated task on today (UTC) to a canonical 10:00/60m each run, so the tests are
  79  |   // order-independent (workers=1, fresh disposable PB per run).
  80  |   test.beforeEach(async ({ pb }) => {
  81  |     const existing = await pb
  82  |       .collection('tasks')
  83  |       .getFullList({ filter: pb.filter('title = {:t}', { t: SEED_TITLE }) })
  84  |     const data = {
  85  |       owner: pb.authStore.record!.id,
  86  |       title: SEED_TITLE,
  87  |       due_date: `${todayUTC()} 00:00:00.000Z`,
  88  |       start_min: SEED_START,
  89  |       dur_min: SEED_DUR,
  90  |       done_at: '',
  91  |     }
  92  |     if (existing.length === 0) await pb.collection('tasks').create(data)
  93  |     else await pb.collection('tasks').update(existing[0].id, data)
  94  |   })
  95  | 
  96  |   test('@l5 dragging a timebox block moves it to a later slot and persists', async ({ page, pb }) => {
  97  |     await signInAndLand(page, pb)
  98  |     await openDayView(page)
  99  | 
  100 |     const block = page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE }).first()
  101 |     await expect(block).toBeVisible({ timeout: 20_000 })
  102 |     // Opens at the seeded slot: top = (600 - 360) * 1 = 240.
  103 |     await expect(block).toHaveAttribute('data-top', String((SEED_START - DAY_START) * PX))
  104 | 
  105 |     // Drag DOWN 120px -> +120 min -> 12:00 (start_min 720). Grab the block's centre.
  106 |     const box = await block.boundingBox()
  107 |     if (!box) throw new Error('block has no bounding box')
  108 |     const cdp = await page.context().newCDPSession(page)
  109 |     await touchDrag(page, cdp, box.x + box.width / 2, box.y + box.height / 2, 0, 120 * PX)
  110 | 
  111 |     // The block re-renders at the committed slot: top = (720 - 360) * 1 = 360.
> 112 |     await expect(block).toHaveAttribute('data-top', String((720 - DAY_START) * PX), { timeout: 20_000 })
      |                         ^ Error: expect(locator).toHaveAttribute(expected) failed
  113 | 
  114 |     // Persistence: the PB record itself moved to 12:00 (proves the runOnBackground commit landed).
  115 |     await expect
  116 |       .poll(
  117 |         async () => {
  118 |           const rec = await pb
  119 |             .collection('tasks')
  120 |             .getFirstListItem(pb.filter('title = {:t}', { t: SEED_TITLE }))
  121 |           return rec.start_min
  122 |         },
  123 |         { timeout: 20_000 },
  124 |       )
  125 |       .toBe(720)
  126 | 
  127 |     // And it survives a reload (re-hydrated from PB, not just optimistic cache).
  128 |     await page.reload({ waitUntil: 'domcontentloaded' })
  129 |     await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
  130 |     await openDayView(page)
  131 |     const reloaded = page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE }).first()
  132 |     await expect(reloaded).toHaveAttribute('data-top', String((720 - DAY_START) * PX), { timeout: 20_000 })
  133 |   })
  134 | 
  135 |   test('@l5 dragging a block above the sheet unschedules it', async ({ page, pb }) => {
  136 |     await signInAndLand(page, pb)
  137 |     await openDayView(page)
  138 | 
  139 |     const block = page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE }).first()
  140 |     await expect(block).toBeVisible({ timeout: 20_000 })
  141 | 
  142 |     // Drag UP well past the top of the sheet (raw start < DAY_START - 20 => "off" => unschedule).
  143 |     const box = await block.boundingBox()
  144 |     if (!box) throw new Error('block has no bounding box')
  145 |     const cdp = await page.context().newCDPSession(page)
  146 |     await touchDrag(page, cdp, box.x + box.width / 2, box.y + box.height / 2, 0, -300 * PX)
  147 | 
  148 |     // Persistence: start_min back to 0 (unscheduled) in PB.
  149 |     await expect
  150 |       .poll(
  151 |         async () => {
  152 |           const rec = await pb
  153 |             .collection('tasks')
  154 |             .getFirstListItem(pb.filter('title = {:t}', { t: SEED_TITLE }))
  155 |           return rec.start_min
  156 |         },
  157 |         { timeout: 20_000 },
  158 |       )
  159 |       .toBe(0)
  160 | 
  161 |     // After a reload it is off the timed grid and back on the shelf.
  162 |     await page.reload({ waitUntil: 'domcontentloaded' })
  163 |     await expect.poll(() => routerPathname(page), { timeout: 30_000 }).toBe('/')
  164 |     await openDayView(page)
  165 |     await expect(
  166 |       page.getByTestId('timebox-shelf-chip').filter({ hasText: SEED_TITLE }).first(),
  167 |     ).toBeVisible({ timeout: 20_000 })
  168 |     await expect(page.getByTestId('timebox-block').filter({ hasText: SEED_TITLE })).toHaveCount(0)
  169 |   })
  170 | })
  171 | 
```