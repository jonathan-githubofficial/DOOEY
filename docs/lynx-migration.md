# DOOEY — Capacitor → Lynx migration plan

**Status:** proposed · **Owner:** Jonathan · **Decision date:** 2026-07-19
**Goal:** make DOOEY *feel native* on mobile by replacing the Capacitor WebView shell
with a native-rendering **Lynx** app that ships to **web + iOS + Android from one codebase**.

> This plan supersedes the "Native iOS & Android (Capacitor)" and parts of the "Tech stack
> (locked)" sections in [CLAUDE.md](../CLAUDE.md). CLAUDE.md must be updated when Phase 1 lands
> (see Phase 8 checklist).

---

## 0. TL;DR

- The "feels off" problem is a **WebView problem**, not a performance problem. Capacitor renders
  your web build inside a browser — web scroll momentum, no native stack push/pop, tap latency,
  browser text selection. Moving to Lynx (native rendering) fixes the root cause.
- **The backend does not change.** PocketBase (API, auth, realtime, `pb_hooks` incl.
  **Google Calendar sync**, migrations), Docker, and the GCE deploy all stay exactly as they are.
  Only the **client** is rewritten.
- **~11.5K LOC / 96 files** to migrate, in three buckets: **port as-is** (pure logic + state +
  data), **adapt** (routing, styling, PB wiring, fonts), **rewrite** (every view, all animation,
  all gestures, the board/doodle canvas).
- **Lynx is the chosen direction** for one-codebase web + iOS + Android with real CSS. The known
  gaps (cloud build/submit, turnkey OTA, some native glue, no Skia) all have workarounds — we'll
  settle each as we reach it rather than treating any as a blocker. See §1.
- **This is a cleanup, not a copy.** The rewrite is the moment to drop code we don't want. Only
  what earns its place comes across; dead paths, unused helpers, half-built bits, and anything
  that no longer fits get left behind (per CLAUDE.md's no-dead-code rule). See §4.
- **Phased, feature-by-feature** (matches DOOEY's "one feature lands fully" philosophy). Boards
  (the canvas) is hardest and goes **last**.

---

## 1. Why Lynx (and how we handle the gaps)

Lynx was chosen for **first-class web + iOS + Android from one codebase with real CSS** — the
closest fit to DOOEY's tactile, CSS-token design language. React Native + Expo was the more
conservative option; we're deliberately betting on Lynx. The framework is young, so some pieces
aren't turnkey yet — but each has a viable path, and we'll pick the concrete alternative as we
hit it. None of these is a dead end.

**Known gaps and how we close them** (verified 2026-07, see §11):

| Concern | Reality on Lynx (2026) | Mitigation |
|---|---|---|
| Cloud build / store submit | No EAS-equivalent. Xcode + Android Studio produce/sign binaries | fastlane in GitHub Actions (§7) |
| OTA updates | No managed service. Engine *can* load remote bundles via a custom `TemplateProvider`/`fetchTemplate` | Build a minimal remote-bundle host later; **not required for v1** (§7) |
| Ecosystem / docs | ~1yr old, sparse libs, buggy docs, breaking changes | Pin versions; spike risky parts first (§9) |
| AI assistance | Little Lynx training data | Expect more trial-and-error; keep the official docs open |
| Skia (boards) | RN-only, unavailable | Lynx **SVG element** (v3.7, Apr 2026) + Main-Thread Scripting (§5.5) |
| Google Calendar / OAuth | Would be a native concern on a thin client | **N/A — it's server-side in `pb_hooks`** ✅ |

---

## 2. Target architecture (before → after)

| Layer | Today (Capacitor/Vite) | After (Lynx) | Bucket |
|---|---|---|---|
| Build tool | Vite + `@vitejs/plugin-react` | **Rspeedy** (`@lynx-js/rspeedy`, Rspack-based) | replace |
| Framework | React 19 + react-dom | **ReactLynx** (`@lynx-js/react`, React 17+ API, Preact-based) + `@lynx-js/react/compat` for React 18 APIs | replace |
| Native shell | Capacitor 8 (`android/`, `ios/` wrap `dist/`) | **Sparkling** app scaffold (native host embeds Lynx engine + bundle) | replace |
| Web target | SPA served by PocketBase `pb_public` | Lynx **web output**, still served by `pb_public` (deploy unchanged) | replace |
| Routing | TanStack Router (browser history) | TanStack Router **Memory routing** (Lynx has no History API) + `url-search-params-polyfill` | **adapt** |
| Client state | Zustand v5 | Zustand v5 (works on ReactLynx) | **port** |
| Server state | TanStack Query v5 | TanStack Query v5 via `compat` + Lynx Fetch adaptation | **adapt** |
| Data SDK | `pocketbase` (fetch + EventSource) | `pocketbase` wired to **Lynx fetch** + `lynx.EventSource` | **adapt** |
| Realtime | `EventSource` (browser) | `lynx.EventSource` (mind PrimJS `TextDecoder` gap) | **adapt** |
| Markup | HTML (`div`/`span`/`button`/`input`…) | Lynx elements (`<view>`/`<text>`/`<image>`/`<scroll-view>`/`<list>`/`<input>`) | **rewrite** |
| Styling | Tailwind **v4** (`@import "tailwindcss"`) + `tw-animate-css` | Tailwind **v3** + `@lynx-js/tailwind-preset` + `rsbuild-plugin-tailwindcss`; keep CSS-var tokens | **adapt** |
| Animation | `motion/react` (30 files) | Lynx **CSS transitions/keyframes** + **Main-Thread Scripting** for gesture-linked motion | **rewrite** |
| Gestures / drag | pointer events + `getBoundingClientRect` (12 files) | Lynx **Main-Thread Scripting** (`'main thread'` directive, `main-thread:` events, `setStyleProperty`) | **rewrite** |
| Doodle canvas | SVG + pointer drawing | Lynx **`<svg>`** (v3.7) + MTS freehand (record stroke as path `d`) | **rewrite** |
| Paper grain | inline `feTurbulence` SVG filter on `body` | **baked tiled PNG** texture (SVG filter support unproven) | **rewrite** |
| UI primitives | shadcn/ui (button, card, input) | hand-built Lynx equivalents (only 3, 2 importers) | **rewrite** |
| Icons | `lucide-react` (React SVG) | ⚠️ needs validation on Lynx `<svg>`; fallback = inline Lynx `<svg>` or icon set (§5.9) | **adapt/rewrite** |
| Fonts | `@fontsource-variable/*` (variable) | `@font-face`/`lynx.addFont` with **static weight instances** (variable-axis + weight unsupported) | **adapt** |
| Persistence | `localStorage` (theme, style, PB authStore) | Sparkling **storage module** / native storage adapter | **adapt** |
| Backend | PocketBase + Docker + GCE | **unchanged** | — |

---

## 3. What does NOT change (leave it alone)

- **PocketBase**: `pb/pocketbase.exe`, all `pb_migrations/*`, and **all `pb_hooks/`** including
  `pb_hooks/calendar-sync.js` (Google Calendar two-way sync is server-side).
- **Docker / deploy**: `Dockerfile`, `docker-compose*.yml`, `.github/workflows/deploy.yml`, the
  GCE VM runbook. The web build output path changes (Rspeedy instead of Vite), but PocketBase
  still serves it from `pb_public`, so the container and deploy flow are the same shape.
- **Pure logic modules** (framework-agnostic TS — copy verbatim):
  `src/lib/date.ts`, `src/lib/format.ts`, `src/lib/cn.ts`, `src/lib/doodle.ts`,
  `src/features/tasks/dates.ts`, `src/features/tasks/timeGrid.ts`,
  `src/features/learning/parse.ts`, `src/features/learning/metrics.ts`,
  `src/features/learning/categories.ts`, `src/features/boards/packs.ts`,
  `src/features/style/tokens.ts`, `src/features/style/backdrop.ts` (drop its `localStorage` bit),
  and every `types.ts`.
- **Program tooling**: `scripts/verify-program.mjs` / `scripts/push-program.mjs` import
  `parse.ts` — unaffected as long as `parse.ts` stays framework-agnostic (it is).

---

## 4. Migration inventory (the three buckets)

> **Port with a broom.** Nothing crosses over by default. Before porting any file, ask: do we
> still want this? If it's dead, unused, duplicated, a leftover experiment, or a feature we've
> cooled on — it stays behind. Prefer deleting to porting. Every phase gate includes a "what did
> we *not* bring over, and why" line so the cleanup is deliberate and recorded, not accidental.
> When in doubt about dropping something non-trivial, flag it rather than silently porting it.

### 4a. Port as-is (logic / state / data — no view code)
Zustand stores (`stores/auth.ts`, `stores/theme.ts` minus localStorage, `features/learning/store.ts`,
`features/style/store.ts`), all `api.ts` PB query/mutation modules, all `types.ts`, all pure-logic
modules from §3. **~Low risk.**

### 4b. Adapt
- `src/lib/pb.ts` — replace `window.location.origin` / `import.meta.env` host resolution; inject
  Lynx fetch + `lynx.EventSource`; back `authStore` with a Lynx storage adapter.
- `src/lib/useCollectionLive.ts` — same PB subscribe logic; verify SSE via `lynx.EventSource`.
- `src/features/auth/api.ts` — logic ports; only the storage backing changes.
- `src/router.tsx` — switch to memory history; keep the pathless `app` guard + `/login?redirect`
  logic; add `@lynx-js/react/compat` (for `startTransition`) + `url-search-params-polyfill`.
- `stores/theme.ts`, `features/style/store.ts`, and the 11 files touching
  `localStorage`/`window`/`document` — route through the storage adapter / remove DOM calls.

### 4c. Rewrite (view + interaction)
Everything in `src/pages/*` (9 pages), every `features/*/components/*` (the bulk of the 61 tsx),
`components/*` (dock, masthead, surface, page sections, doodle editor, editable), and the 3
`components/ui/*`. All `motion/react` usage (30 files) and all pointer/drag code (12 files) is
re-authored on Lynx primitives. **Highest effort; boards + calendar-grid + doodle canvas are the
top risks.**

---

## 5. Load-bearing decisions & risks (resolved)

### 5.1 Styling — Tailwind v4 → v3 + Lynx preset
Lynx interprets a **subset** of CSS and needs **Tailwind v3** with `@lynx-js/tailwind-preset`
(+ `rsbuild-plugin-tailwindcss`). Action: downgrade Tailwind, port `global.css` `@theme`/v4
directives to a `tailwind.config.js` preset; **keep the CSS-variable design tokens** (`--paper`,
`--ink`, `--leaf`, `--zest`, `--radius-card`, `.shadow-soft`, …) — CSS variables, gradients, and
`box-shadow` are supported. Drop `tw-animate-css` (replaced by Lynx CSS animations). Consider
`@lynx-js/tailwind-preset-canary` if DX is rough. **Gotcha:** Lynx lacks core pseudo/data-attr
selectors — use the preset's `uiVariants` for component states. **Text doesn't inherit CSS** —
declare `color`/`font-family`/size explicitly on every `<text>`.

### 5.2 Navigation — TanStack Router (memory) first, Sparkling native later
TanStack Router works on Lynx via **Memory routing** (no browser History API). This preserves
`router.tsx`'s route tree and the auth guard almost verbatim — a big win. Tabs (the bottom dock)
are instant swaps, so memory routing feels fine there. **If** drill-ins (task/board/program
detail) don't feel native enough, layer **Sparkling native navigation** (scheme-based, native
push/pop) for those stacks in a later pass. Start with memory routing.

### 5.3 Animation — `motion/react` → CSS + Main-Thread Scripting
No Framer Motion. Two tools:
- **Declarative enter/exit/settle** → Lynx CSS transitions + keyframes (springs approximated with
  cubic-bezier; keep "settle, don't snap" via small overshoot easings).
- **Gesture-linked motion** (press-depress, drag, timebox drag, board objects) → **Main-Thread
  Scripting**: mark handlers `'main thread'`, bind with `main-thread:bind...`, mutate via
  `event.currentTarget.setStyleProperty(...)`, hold state with `useMainThreadRef`.
- **Reduced-motion**: verify Lynx exposes a reduced-motion signal; if not, gate via a Zustand
  pref. (Risk — confirm in spike.)
- **MTS constraints to design around:** captured vars must be JSON-serializable, functions run
  only **after TTI** (no first-paint animations), no nested defs, can't mutate outer-scope vars.

### 5.4 PocketBase realtime + fetch
PB SDK uses `fetch` + `EventSource`. Wire the SDK to **Lynx fetch** and **`lynx.EventSource`**
(same API as web). **Risk:** PrimJS lacks `TextEncoder`/`TextDecoder` — SSE payload decoding may
need a `TextCodecHelper`/polyfill; standard streaming fetch is experimental
(`enableFetchAPIStandardStreaming`). De-risk in the Phase 0 spike (a live PB subscription
round-trip). Auth persistence (`pb.authStore`) moves off `localStorage` onto the storage adapter.

### 5.5 Boards doodle canvas — SVG element + MTS (no Skia)
Lynx **`<svg>`** landed in v3.7 (Apr 2026). Build freehand drawing by capturing pointer moves in a
main-thread handler and appending to an SVG path `d` (`M x y` / `L x y`), storing strokes as path
data (scalable, serializable to PB) — the react-sketch-canvas approach, hand-rolled for Lynx.
Board objects (notes/stickers) drag via MTS transforms. **Highest risk in the whole migration** —
SVG is new and had display bugs (#290). Prototype in the Phase 0 spike before committing the phase.

### 5.6 Paper grain
The `feTurbulence` filter on `body` is unlikely to port (SVG filter support unproven). Bake a
seamless **tiled PNG** grain (2–3% opacity) and apply as a repeating background. Cheap, reliable,
identical look.

### 5.7 Fonts (Fraunces + Outfit)
`@font-face` on Lynx **ignores `font-weight`/`font-style`/`font-variant`**, so **variable fonts
won't switch weight**. Replace `@fontsource-variable/*` with **static per-weight instances**
(Outfit 400/500/600/700; Fraunces bold/black), register each family+weight via `@font-face` or
`lynx.addFont`. **Android has known custom-font bugs** — prefer `.ttf` + `local(file://…)` and
test on-device early.

### 5.8 Persistence
`localStorage` (theme, style prefs, PB authStore) → Sparkling **storage module** or a thin native
storage adapter. Small surface; do it once in `lib/` and reuse.

### 5.9 Icons — validate `lucide-react`
`lucide-react` emits React DOM `<svg>`. On Lynx it may or may not render through the new `<svg>`
element. **Validate in the spike.** Fallback: generate the ~20 icons actually used as inline Lynx
`<svg>` (or a small custom set in `components/icons`, matching the existing ornament pattern).

---

## 6. Phased execution plan

> Ship order mirrors CLAUDE.md's "one feature lands fully." Each phase is independently testable.

### Phase 0 — De-risk spike (before committing to the full port)
Prove the scary parts in a throwaway Lynx app: (1) live PocketBase auth + a realtime subscription
via `lynx.EventSource`; (2) Tailwind-preset styling of one tactile `Panel` with soft shadow +
token colors; (3) a freehand stroke drawn on `<svg>` via MTS; (4) `lucide-react` render test;
(5) fonts on a physical Android device. **Gate:** all five must work (or have a known workaround)
before Phase 2+. *Output: a short "spike findings" note appended here.*

### Phase 1 — Scaffold + Capacitor teardown + shared core
- `npm create rspeedy` → ReactLynx + TypeScript; add Sparkling scaffold for the native hosts.
- Wire Tailwind v3 + `@lynx-js/tailwind-preset`; port design tokens.
- Extract §3 pure-logic modules + stores + `api.ts` into the new tree unchanged.
- Build the PB client seam: Lynx fetch + `lynx.EventSource` + storage-backed authStore.
- **Remove Capacitor** (do this here, once Lynx builds — not before, so mobile is never at zero):
  delete `android/`, `ios/`, `capacitor.config.ts`; drop `@capacitor/*` deps and the
  `mobile:sync` script.
- **Gate:** app boots on iOS sim, Android emulator, and web; a signed-in PB query renders.

### Phase 2 — Design system & primitives
Fonts (static instances), paper-grain PNG, `Backdrop`, and the tactile primitives (`Panel`,
`Eyebrow`, `Button`, `Card`, `Input`) rebuilt on Lynx elements. Safe-area handling (replace
`env(safe-area-inset-*)` with Lynx safe-area insets). **Gate:** a primitives gallery matches the
web look on all three targets.

### Phase 3 — Navigation shell + auth
`router.tsx` on memory routing; the pathless guard + `/login?redirect`; `initSession` on boot;
`pb.authStore.onChange → router.invalidate`; the **bottom dock** + masthead + Account. **Gate:**
sign in/out, guard redirects, tab-to-anywhere all work natively.

### Phase 4 — Tasks / Planner (Today)
`Today`, quick-add composer, task cards, and **task pages** (notes / checklist / resources /
attachments). Press/complete micro-interactions via MTS. Recurring-habit progress. **Gate:** full
task lifecycle persists + realtime-updates across devices.

### Phase 5 — Calendar
`Calendar`, `WeekStrip`/`WeekGrid`/`MonthView`, and the **timebox drag** (MTS gesture). Verify
calendar events from `pb_hooks/calendar-sync.js` render in Today + Calendar. **Gate:** dated tasks
+ Google events interleave correctly; timebox drag feels native.

### Phase 6 — Projects / Learning
`Projects`, folder cards, program header/runway/materials, `Markdown` renderer, `ProjectTasks`,
`useProgramSync`. Confirm `verify-program`/`push-program` still materialize sessions into tasks.
**Gate:** a pushed program appears live and its sessions are real tasks.

### Phase 7 — Boards (hardest — last)
`Boards`/`Board`, `BoardCanvas`, `BoardObject`, doodle editor/tray/glyphs on `<svg>` + MTS drag +
freehand from the Phase 0 spike. **Gate:** create/move/group objects and draw doodles at 60fps on
a mid device.

### Phase 8 — Cross-platform polish & cutover
iOS/Android native builds signed + submitted (§7); web output wired into `pb_public`; on-device QA
pass; **update CLAUDE.md** (kill the Capacitor/"no React Native" sections, add Lynx); decide on OTA
(§7). **Gate:** store builds accepted; web deploy identical to today.

---

## 7. Build & deploy pipeline (the EAS replacement)

| Stage | Tool | Notes |
|---|---|---|
| Dev iterate | Rspeedy dev server + **Lynx Explorer** | QR-load the bundle; fast refresh (watch the known style-HMR quirk) |
| Build JS | `rspeedy build` | emits `.lynx.bundle` (native) + web output |
| Native hosts | **Sparkling** iOS/Android shells | embed the Lynx engine + bundle |
| Sign/submit iOS | Xcode + App Store Connect | automate with **fastlane** |
| Sign/submit Android | Android Studio + Play Console | automate with **fastlane** |
| CI | GitHub Actions + fastlane | mirror the existing SSH-deploy workflow style |
| Web deploy | PocketBase `pb_public` on GCE | **unchanged** from today |
| OTA (optional, later) | custom `TemplateProvider`/`fetchTemplate` fetching `.lynx.bundle` from a URL (host on GCE/PB) | you build versioning + rollback; **skip for v1** |

Honest note: this is the DIY cost of choosing Lynx over EAS. It's real work but bounded, and the
**web deploy stays identical**.

---

## 8. Dependency changes

**Remove:** `@capacitor/{core,android,ios,cli}`, `motion`, `tw-animate-css`, `tailwindcss@4`,
`@tailwindcss/vite`, `@fontsource-variable/{fraunces,outfit}`, `vite`, `@vitejs/plugin-react`,
`@radix-ui/react-slot` (shadcn). Remove `mobile:sync`.

**Add:** `@lynx-js/rspeedy`, `@lynx-js/react`, `@lynx-js/tailwind-preset`,
`rsbuild-plugin-tailwindcss`, `tailwindcss@3`, `url-search-params-polyfill`, Sparkling packages,
static `@fontsource/{outfit,fraunces}` (non-variable). Add a `TextDecoder` shim if the SSE spike
needs it.

**Keep:** `pocketbase`, `@tanstack/react-query`, `@tanstack/react-router` (+ add
`@tanstack/router-plugin`), `zustand`, `clsx`, `tailwind-merge`, `class-variance-authority`.
**Validate:** `lucide-react` (§5.9).

---

## 9. Spikes to run first (Phase 0 checklist)
- [ ] PB auth + realtime subscription over `lynx.EventSource` (the `TextDecoder` question)
- [ ] Tactile `Panel` via Tailwind preset (soft shadow + tokens) on web/iOS/Android
- [ ] Freehand stroke on `<svg>` via a main-thread gesture handler
- [ ] `lucide-react` render test (else plan the icon fallback)
- [ ] Static-instance fonts on a physical Android device

---

## 10. Open decisions for you
1. **Navigation:** OK to start with **TanStack memory routing** (keeps `router.tsx`), and only add
   Sparkling native stacks for drill-ins if transitions feel off? *(recommended)*
2. **Web parity:** must the web target reach **full feature parity** at cutover, or is
   mobile-first acceptable with web catching up? *(affects Phase 8 scope)*
3. **OTA:** build the custom remote-bundle/OTA host now, or defer post-v1? *(recommended: defer)*
4. **Timing of Capacitor removal:** delete in Phase 1 once Lynx builds *(recommended)*, or keep
   the old shells until Phase 8 as a fallback?

---

## 11. References (verified 2026-07)
- Lynx Rspeedy / build: https://lynxjs.org/rspeedy/ · https://lynxjs.org/guide/start/quick-start
- Sparkling (app framework): https://www.callstack.com/events/sparkling-a-new-framework-for-lynx
- Styling / Tailwind preset: https://lynxjs.org/rspeedy/styling · https://www.npmjs.com/package/@lynx-js/tailwind-preset
- ReactLynx + React ecosystem (Zustand/TanStack): https://lynxjs.org/react/data-fetching · https://lynxjs.org/react/routing/tanstack-router
- Networking / EventSource (SSE): https://lynxjs.org/guide/interaction/networking
- Main-Thread Scripting (gestures/anim): https://lynxjs.org/react/main-thread-script
- SVG element (v3.7): https://lynxjs.org/next/blog/lynx-3-7
- Fonts: https://lynxjs.org/api/css/at-rule/font-face.html · https://lynxjs.org/api/lynx-api/lynx/lynx-add-font
- Native modules & limits: https://lynxjs.org/guide/use-native-modules · https://lynxjs.org/blog/lynx-open-source-roadmap-2026
- RN New Architecture (context for the perf comparison): https://www.bolderapps.com/blog-posts/react-natives-2026-new-architecture-how-jsi-and-fabric-finally-killed-the-performance-bridge
