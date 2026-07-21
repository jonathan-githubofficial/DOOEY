# DOOEY Capacitor -> Lynx migration - HANDOFF

Self-contained brief for the next agent/session. Pure ASCII. Last updated 2026-07-20
at commit dad06a3 on branch lynx/migration.

## What this is

Full client rewrite of DOOEY (personal life OS) from Capacitor/Vite/React-DOM to
ReactLynx (Lynx) built by Rspeedy, per docs/lynx-migration.md (the PLAN). The
PocketBase backend, pb_hooks (incl. Google Calendar sync), migrations, Docker and
GCE deploy are UNCHANGED. Only the client is rewritten. The bar for this effort:
full feature parity on the WEB target, verified by the Playwright E2E suite in e2e/
plus visual A/B against the original app. Native (iOS/Android via Sparkling) is out
of mechanical reach on this Windows box and is handled as a written runbook only.

## Where everything lives

- Repo: C:\Croesus\Central\Repos\test2\DOOEY  (operator's main tree - NEVER modify;
  the original app still lives there on main and is used for visual A/B)
- Worktree (ALL work happens here): C:\Croesus\Central\Repos\test2\DOOEY\.worktrees\lynx
  on branch lynx/migration. Never push/PR/merge - the operator does that.
- The PLAN: docs/lynx-migration.md
- The charter: docs/lynx-run/orchestration-framework.md - READ IT FIRST. Rulings
  R1-R12 at the bottom pre-answer the hard decisions; they are binding.
- Per-unit instructions: docs/lynx-run/stories/*.md (31 units, layers L1-L8).
- Lynx knowledge: .claude/skills/ (reactlynx-best-practices, lynx-check-css-support,
  lynx-ui, lynx-typescript, ...) - read these BEFORE guessing any Lynx API; there is
  almost no Lynx in model training data. Mirror at .scratch/lynx-skills/.

## State at dad06a3 (what is DONE - all committed, one commit per unit)

- L1 foundation (units 1.1-1.6): Rspeedy/ReactLynx toolchain replaces Vite (old app
  moved to src-legacy/, brooming in progress); pure logic + stores + api ported;
  PocketBase client seam with cross-thread storage (ruling R11); Playwright E2E
  oracle vs disposable PocketBase; Capacitor fully removed (branch-only).
- L2 design system (2.1-2.4): static per-weight fonts, grain + Backdrop, tactile
  primitives (Panel/Eyebrow/StampButton/Stamp/Button/Card/Input), hand-authored
  inline Lynx <svg> icon set (lucide dropped).
- L3 shell + auth (3.1-3.4): TanStack Router on memory history + pathless guard +
  /login?redirect; SignInCard/Login + full session lifecycle (4xx-only drop rule);
  dock/masthead/Account; Style studio + theme via root-view CSS-var cascade.
- L4 tasks (4.2, 4.3, 4.1): task pages (notes/checklist/resources/attachments-read),
  sheets + MTS micro-interactions, Today/Planner with quick-add. Gate fix: one
  ref-counted PB realtime subscription per collection (shared by useCollectionLive).
- L5 calendar, partial: 5.1 calendar views (week/month/day + restored Today shelf)
  and 5.2 timebox drag via Main-Thread Scripting, incl. the reusable Playwright
  touch-simulation recipe (see e2e timebox-drag specs).
- Fidelity repair (commit dad06a3): see "Design fidelity conventions" below - the
  web app now visually matches the original on login/planner/gallery/style.
- E2E suite: 27 specs; 24 green at dad06a3; the 3 red ones are all in the 5.3 domain
  (see next section).

Every layer passed a gate (typecheck + build + cumulative tagged E2E) when it landed.
Two run journals exist if archaeology is needed:
C:\Users\jonathanh\.claude\projects\C--Users-jonathanh-Desktop\5c65ec48-1a79-423f-ab22-79e92c30d8d4\subagents\workflows\{wf_746363cc-678,wf_ebb7948c-480}\journal.jsonl

## UNCOMMITTED work in the worktree right now (inherit it, do not discard)

Unit 5.3 (gcal events) was interrupted twice; the tree holds its WIP plus fixes from
the last (killed) agent:
  M lynx.config.ts, scripts/dev.mjs        (last agent's E2E/dev fixes)
  M src/features/tasks/api.ts, TimeboxSheet.tsx, WeekGrid.tsx, index.ts
  M src/pages/Calendar.tsx, src/pages/Today.tsx
  ?? e2e/gcal-events.spec.ts
  M .vscode/tasks.json                     (incidental port-label edit; harmless)
Last known test state: gcal + most timebox specs fixed (a real drag-logic bug was
found and fixed); 2 timebox-drag specs still failed with "__dooeyRouter bridge
worker not found ... no workers attached" during sign-in - an E2E BOOT FLAKE under
full-suite load (worker attach race), NOT app logic. Finish 5.3, make all @l5 green,
commit as "lynx(5.3-gcal-events): ...".

## What is LEFT (in order)

1. Finish 5.3 (WIP above). Ruling R2: read-only rendering of calendar_events seeded
   as superuser fixtures; pb_hooks/calendar-sync.js is out of bounds.
2. L6 learning: stories 6.1 (Projects page), 6.2 (program detail incl. Markdown ->
   Lynx elements), 6.3 (program sync + scripts/verify-program + push-program proven
   against the disposable PB).
3. L7 boards: stories 7.1 (list), 7.2 (canvas + MTS drag), 7.3 (doodles on <svg> +
   MTS freehand). Reuse the 5.2 touch recipe for the E2E specs. Highest-risk layer.
4. L8 cutover: stories 8.1 (web output -> pb_public/Dockerfile wiring), 8.2 (broom:
   src-legacy must end EMPTY and removed, with a written record), 8.3 (CLAUDE.md +
   docs update - kill Capacitor sections), 8.4 (full E2E + parity checklist incl.
   recorded gaps below), 8.5 (WRITE docs/lynx-run/native-hosts-runbook.md for the
   operator: Sparkling hosts, fastlane, on-device QA of all PARKED items).
5. Final: full suite green from a fresh disposable PB; visual A/B on every space.

Recorded parity gaps (deliberate, per rulings - keep them recorded, do not "fix"):
- Habits: do not exist in the current app (collections dropped in migration 006) -
  out of scope (R1).
- Attachments file-ADD: no verified file-picker path on Lynx web at 4.2 time -
  attachments are read/list/open/remove; ADD parked (R7). Re-probe allowed.
- Backdrop custom image upload: same R7 finding chain (3.4).
- StyleStudio palette rows render always-expanded vs original tap-to-expand
  (component behavior delta noted at fidelity repair; acceptable or fix in passing).

## How to work (process that proved out)

- Per unit: implement per story + fidelity conventions -> npm run typecheck &&
  npm run build -> unit's tagged E2E green -> VISUAL A/B for user-facing pages ->
  commit "lynx(<unit-id>): <summary>" -> broom consumed src-legacy files (git rm).
- Visual A/B is NON-NEGOTIABLE for new pages: build/typecheck/E2E all stayed green
  while the UI looked broken (fonts 404ing, invisible labels). Only eyes catch this.
- E2E infra: e2e/README.md documents the disposable PB (port 8091, fresh data dir
  under .scratch/pb-e2e/, superuser+user auto-seeded) and web host (4173).
- Visual A/B rig (shared-data, both apps against ONE PocketBase):
  - Disposable PB on 8092: run from ..\manual-test: ./pb/pocketbase.exe serve
    --http 127.0.0.1:8092 --dir .scratch/pb-manual/pb_data --migrationsDir
    pb/pb_migrations --hooksDir pb/pb_hooks   (test creds: manual-test worktree
    .scratch/pb-manual/creds.json; user manual@dooey.local)
  - Original app on 5175: from the MAIN tree: VITE_PB_URL=http://127.0.0.1:8092
    npx vite --port 5175 --strictPort
  - Lynx build on 4175: PUBLIC_PB_URL=http://127.0.0.1:8092 npm run build, host page
    pattern in .scratch/fidelity/ (copy of e2e/web-host with publicDir -> dist).
  - Screenshot pairs: scripts pattern in .scratch/fidelity/ and ../manual-test/
    .scratch/pb-manual/{shot.mjs,shot2.mjs} (seed localStorage "pb_auth" for lynx,
    "pocketbase_auth" for the original, then reload). READ the PNGs and judge.
- Operator's manual-test instance (leave it alone unless refreshing it for the
  operator): ../manual-test worktree, host on 4174, PB on 8092.
- Ports: 8090 belongs to the operator's REAL PocketBase dev - never use it.
  8091/4173 = E2E. 8092/4174/5175/4175 = A/B + manual rig. 3000 = rspeedy dev.

## Design fidelity conventions (from dad06a3 - every new screen must follow)

- Root: ThemeVars renders the root <view> with bg-paper + inline
  font-family var(--app-font-sans) + full-screen GrainOverlay on every route.
  font-family DOES inherit to <text> on the web target; color does NOT.
- NEVER put a bare string/number child inside a flex <view> - it renders 0x0.
  Wrap in <text class="text-inherit"> (Button/StampButton/Stamp already do).
- Font stacks lead with real @font-face names (Outfit-400.., Fraunces-700..):
  one family name PER weight; fonts + grain ship as data URIs via
  lynx.config.ts output.dataUriLimit (webpack:/// asset URLs break @font-face).
- text-transform utilities are hand-added in src/styles/global.css (the Lynx
  tailwind preset drops them); .inset-well, .stamp-edge, .grain-page live there too.
- Grain PNG must stay near-white noise (mean ~232); multiply blend.
- CSS support questions: use the lynx-check-css-support skill, not guesses.

## Hard-won platform gotchas (respect these or lose hours)

- R11: the web target runs the app in a Web Worker - NO window/document/
  localStorage anywhere in src/. Storage goes through the NativeStorageModule seam
  (host page registers it; app reads the BARE `NativeModules` identifier - it is a
  bundle-scope binding, not on globalThis). PB origin comes from PUBLIC_PB_URL at
  build time or globalProps.pbUrl from the host page.
- MTS (main-thread scripting): no getBoundingClientRect on MainThread.Element -
  measure via SelectorQuery invoke({method:'boundingClientRect'}) cached at
  touchstart, or element-local touches[0].x/y. Captured vars must be
  JSON-serializable; handlers run only after TTI.
- PB realtime: ONE ref-counted subscription per collection (see useCollectionLive);
  naive per-hook subscriptions drop SSE events.
- Playwright touch simulation DOES reach main-thread:bindtouch* handlers on the web
  target - the working recipe is in the 5.2 timebox-drag specs.
- Windows: stop dev servers/watchers before mass git renames/deletes (dir-handle
  locks); per-file git mv/rm works when a lock persists. Never git stash.
- npm-install-bearing changes commit immediately (lockfile cannot be split later).

## Hard rules (unchanged, non-negotiable)

- pb/pb_data anywhere = the operator's REAL personal data. Never serve, read,
  write, copy, or delete it. Disposable instances only, under .scratch/.
- Never push, PR, merge, or tag. Never loosen a STOP: on real ambiguity outside
  stories+rulings, stop and record the exact question for the operator.
- Deletions only via git rm of files a story explicitly brooms out.
- Non-interactive commands only; credentials via env/gitignored files only.
