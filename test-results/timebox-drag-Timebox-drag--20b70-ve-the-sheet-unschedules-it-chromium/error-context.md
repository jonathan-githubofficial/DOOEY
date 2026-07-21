# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: timebox-drag.spec.ts >> Timebox drag @l5 >> @l5 dragging a block above the sheet unschedules it
- Location: e2e\timebox-drag.spec.ts:135:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 600

Call Log:
- Timeout 20000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e8]:
  - generic [ref=e9]:
    - generic [ref=e13]:
      - generic: Calendar
    - generic [ref=e14]:
      - generic [ref=e18]:
        - generic [ref=e21]:
          - generic: day
        - generic [ref=e24]:
          - generic: week
        - generic [ref=e27]:
          - generic: month
      - generic [ref=e51]:
        - generic [ref=e59]:
          - generic [ref=e60]:
            - generic [ref=e62]:
              - generic: Today
            - generic [ref=e67]:
              - generic: Jul 21
          - generic [ref=e71]:
            - generic:
              - generic [ref=e72]: "8"
              - text: to do
        - generic [ref=e73]:
          - generic [ref=e76]:
            - generic: on the shelf
          - generic [ref=e77]:
            - generic [ref=e82]:
              - generic: Ship the Lynx port
            - generic [ref=e87]:
              - generic: Errands
            - generic [ref=e92]:
              - generic: Trip prep
            - generic [ref=e97]:
              - generic: sse-roundtrip-1784608084744
            - generic [ref=e102]:
              - generic: Quick add 1784608082012
          - generic [ref=e104]:
            - generic: Drag a slip onto the day below to give it a time.
        - generic:
          - generic:
            - generic [ref=e105]:
              - generic [ref=e108]:
                - generic: 6a
              - generic [ref=e112]:
                - generic: :30
              - generic [ref=e116]:
                - generic: 7a
              - generic [ref=e120]:
                - generic: :30
              - generic [ref=e124]:
                - generic: 8a
              - generic [ref=e128]:
                - generic: :30
              - generic [ref=e132]:
                - generic: 9a
              - generic [ref=e136]:
                - generic: :30
              - generic [ref=e140]:
                - generic: 10a
              - generic [ref=e144]:
                - generic: :30
              - generic [ref=e148]:
                - generic: 11a
              - generic [ref=e152]:
                - generic: :30
              - generic [ref=e156]:
                - generic: 12p
              - generic [ref=e160]:
                - generic: :30
              - generic [ref=e164]:
                - generic: 1p
              - generic [ref=e168]:
                - generic: :30
              - generic [ref=e172]:
                - generic: 2p
              - generic [ref=e176]:
                - generic: :30
              - generic [ref=e180]:
                - generic: 3p
              - generic [ref=e184]:
                - generic: :30
              - generic [ref=e188]:
                - generic: 4p
              - generic [ref=e192]:
                - generic: :30
              - generic [ref=e196]:
                - generic: 5p
              - generic [ref=e200]:
                - generic: :30
              - generic [ref=e204]:
                - generic: 6p
              - generic [ref=e208]:
                - generic: :30
              - generic [ref=e212]:
                - generic: 7p
              - generic [ref=e216]:
                - generic: :30
              - generic [ref=e220]:
                - generic: 8p
              - generic [ref=e224]:
                - generic: :30
              - generic [ref=e228]:
                - generic: 9p
              - generic [ref=e232]:
                - generic: :30
              - generic [ref=e236]:
                - generic: 10p
              - generic [ref=e240]:
                - generic: :30
              - generic [ref=e244]:
                - generic: 11p
            - generic:
              - generic [ref=e249]:
                - generic:
                  - generic:
                    - generic: L5 seed event
                - generic:
                  - generic:
                    - generic:
                      - generic:
                        - generic [ref=e250]: 2p
                        - text: "-"
                        - generic [ref=e251]: 3p
              - generic [ref=e254]:
                - generic:
                  - generic:
                    - generic:
                      - generic: L5 seed block
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic [ref=e257]: 10a
                          - text: "-"
                          - generic [ref=e258]: 11a
              - generic [ref=e261]:
                - generic:
                  - generic:
                    - generic:
                      - generic: L5 drag block
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic [ref=e264]: 10a
                          - text: "-"
                          - generic [ref=e265]: 11a
              - generic [ref=e268]:
                - generic:
                  - generic:
                    - generic:
                      - generic: L5 task block
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic [ref=e271]: 7:15a
                          - text: "-"
                          - generic [ref=e272]: 8:15a
  - generic [ref=e282]:
    - generic [ref=e285]:
      - generic [ref=e292]:
        - generic: DOOEY
      - generic [ref=e295]:
        - generic: .
    - generic [ref=e297]:
      - generic [ref=e303]:
        - generic:
          - generic: Planner
      - generic [ref=e311]:
        - generic: Calendar
      - generic [ref=e317]:
        - generic:
          - generic: Boards
      - generic [ref=e323]:
        - generic:
          - generic: Projects
```

# Test source

```ts
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
  112 |     await expect(block).toHaveAttribute('data-top', String((720 - DAY_START) * PX), { timeout: 20_000 })
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
> 159 |       .toBe(0)
      |        ^ Error: expect(received).toBe(expected) // Object.is equality
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