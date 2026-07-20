# DOOEY Lynx migration - orchestration framework

Pure ASCII. This is the charter every agent in the run must read FIRST.
The authoritative migration plan is docs/lynx-migration.md (the "PLAN"). Story files
under docs/lynx-run/stories/ are the per-unit instructions and are AUTHORITATIVE for
their unit. This file defines how the run works and the rules nobody may break.

## Objective

Fully apply docs/lynx-migration.md: replace the Capacitor/Vite/React-DOM client with a
ReactLynx (Lynx) app built by Rspeedy, keeping PocketBase/Docker/deploy untouched, so
that the WEB target reaches full feature parity with today's app and is verified by a
real E2E suite. Native-host work that requires macOS/Xcode/Android SDK is written up
and PARKED (this machine cannot verify it) - never faked.

## Machine constraints (Windows box, verified 2026-07-19)

- Windows 11, git bash. Node v24.14.0, npm 11.9.0 available.
- NO Xcode (impossible on Windows), NO Android SDK, no adb. Any "boots on iOS sim /
  Android emulator / physical device" gate from the PLAN is out of mechanical reach:
  park it in the story's parked-list, do NOT claim it.
- PocketBase binary at pb/pocketbase.exe with pb_migrations/ and pb_hooks/.
- pb/pb_data is the operator's REAL personal data. IT IS UNTOUCHABLE (see hard rules).
- The only browser oracle is headless Chromium via Playwright against the Lynx WEB
  output. That is the run's E2E oracle.

## Decisions record (PLAN section 10, resolved for this run)

1. Navigation: TanStack Router MEMORY routing (PLAN-recommended). Sparkling native
   stacks are a possible later pass, out of scope here.
2. Web parity: FULL feature parity on the web target is the bar for this run (it is
   the only target verifiable on this machine).
3. OTA: deferred post-v1 (PLAN-recommended). Do not build it.
4. Capacitor removal: in Layer 1, ON THIS BRANCH ONLY (PLAN-recommended). main keeps
   the shells, so the product is never at zero mobile.

## The two-plane split

- The harness (docs/lynx-run/harness.workflow.js) is the deterministic control plane:
  ordering, gating, fan-out, schemas, resume. It makes zero judgment calls.
- Judgment nodes (plan review, gate rulings, rescue, digest) run on the top brain.
- Workers execute exactly one unit at a time and return their typed contract only.

## Tier charter

- brain  (fable): judgment only - plan review, halt digests, final digest.
- heavy  (opus): hard/high-risk labor - foundation seam, auth, MTS gesture work,
  boards/canvas, rescues of failed units.
- normal (sonnet): scoped mechanical-but-real labor - ports following a pattern,
  design-system pieces, docs updates.
- cheap  (haiku): evidence only - running gate commands and reporting pass/fail,
  idempotent setup checks, writing the manifest. Never direction.

Escalation: a unit failed at its tier once -> retried by the harness at heavy with
the failure evidence attached. Still failed/blocked -> the layer is not green -> the
chain halts and the digest reports the exact human decision needed. Nobody loosens a
STOP.

## Layers (strict bottom-up; serial; each unit = one story file)

L1 foundation  [heavy]: 1.1 scaffold, 1.2 pure-logic port, 1.3 stores+api port,
               1.4 PB client seam, 1.5 E2E oracle, 1.6 Capacitor teardown
L2 design      [normal]: 2.1 fonts, 2.2 grain+backdrop, 2.3 primitives+safe-area,
               2.4 icons
L3 shell+auth  [heavy]: 3.1 router+guard, 3.2 auth UI+session, 3.3 dock+masthead+
               account, 3.4 style/theme studio
L4 tasks       [heavy]: 4.1 today+composer+habits, 4.2 task pages, 4.3 interactions+
               sheets
L5 calendar    [heavy]: 5.1 calendar views, 5.2 timebox drag (MTS), 5.3 gcal events
               render
L6 learning    [normal]: 6.1 projects page, 6.2 program detail, 6.3 program sync +
               scripts compat
L7 boards      [heavy]: 7.1 boards list, 7.2 board canvas+objects, 7.3 doodles
L8 cutover     [normal]: 8.1 web deploy wiring, 8.2 broom audit, 8.3 CLAUDE.md+docs,
               8.4 full E2E parity, 8.5 native hosts (PARKED - manual runbook only)

## Tree convention (progressive port; every story uses these paths)

- Unit 1.1 renames the old app `git mv src src-legacy` and scaffolds the ReactLynx
  app with its source in a fresh `src/` (rspeedy defaults), excluding src-legacy from
  tsconfig/build/lint. The final repo layout therefore matches CLAUDE.md's documented
  `src/` shape.
- src-legacy/ is READ-ONLY reference. Each unit ports what its story lists, then
  `git rm`s the src-legacy files it consumed (ported OR deliberately dropped - the
  broom record in the unit result says which). src-legacy/ must be EMPTY and removed
  by unit 8.2; anything still in it at 8.2 is an undecided leftover to rule on.
- New-tree layout mirrors the old one (components/, features/<feature>/, lib/,
  stores/, pages/, styles/) per CLAUDE.md's repository-layout section.
- `npm run typecheck` = tsc --noEmit over the NEW tree + e2e/ only (1.1 adds it).

## The verification oracle (what "done" means, mechanically)

Baseline commands (all run from the worktree root):
- Typecheck: npm run typecheck   (tsc --noEmit over the new tree)
- Build:     npm run build       (rspeedy build - web output at least)
- Lint:      npm run lint
- E2E:       npx playwright test [--grep <layer tag>]
  The E2E suite lives in e2e/ and runs against the Lynx WEB output served with a
  DISPOSABLE PocketBase instance (see below). Unit 1.5 builds this harness; every
  later layer ADDS specs tagged for its layer (e.g. @l4). A layer's gate = typecheck
  + build + that layer's tagged specs + all previously-green tags still green.

Disposable PocketBase (the only mutable environment):
- Serve: pb/pocketbase.exe serve --http 127.0.0.1:8091 --dir .scratch/pb-e2e/pb_data
  --migrationsDir pb/pb_migrations --hooksDir pb/pb_hooks
- Fresh data dir built from migrations; reset = stop, delete NOTHING by hand, create
  a NEW dir (.scratch/pb-e2e/pb_data-<n>) if a clean slate is needed.
- Superuser + a test app user are created by the E2E fixture; credentials are
  generated once into .scratch/pb-e2e/creds.json (gitignored). Never inline creds in
  commands; never reuse the operator's .env.local credentials.
- pb_hooks load as-is; calendar-sync.js without Google tokens must fail soft - if it
  crashes the disposable instance, report it as a finding (do not patch pb_hooks).

Staged validation ladder (never blind, stop at first REAL defect):
  typecheck -> build -> boot smoke (@l1) -> auth (@l3) -> one write (@l4) ->
  layer tags in order -> full suite. Short timeouts early. An APP defect stops the
  stage; a fixture/flake issue may continue but must be noted.

## Hard rules (every agent, no exceptions)

- Work ONLY inside the worktree C:\Croesus\Central\Repos\test2\DOOEY\.worktrees\lynx
  on branch lynx/migration. Never modify the main tree above it (the repo root
  C:\Croesus\Central\Repos\test2\DOOEY itself) except via this worktree path.
- NEVER touch pb/pb_data (the operator's real data): never serve against it, never
  read/write/copy/delete it. The disposable instance uses .scratch/pb-e2e/ only.
- Never push, never open a PR, never merge, never create tags. Commit locally on
  lynx/migration, one commit per unit, message "lynx(<unit-id>): <summary>".
- Never `git stash` (worktrees share one stash stack). Commit WIP instead.
- Deletions: `git rm` of tracked files that a story EXPLICITLY brooms out is allowed
  and expected (that is the migration). NOTHING else gets deleted - no rm -rf of
  untracked dirs, no cleaning scratch, no deleting in pb/. Deletion prompts block an
  unattended run; leftover files do not.
- Scratch/temp/spike files go ONLY under .scratch/<task>/ (git-excluded already).
- Non-interactive ALWAYS: every command must run without a TTY prompt (use --yes,
  --template flags, CI=1, etc.). A hanging prompt freezes the whole run.
- Credentials via env vars or gitignored files only; never inline in a command line.
- On ambiguity a story does not cover, or any HIGH-RISK call (auth/session semantics,
  data-shape changes, anything touching pb_migrations or pb_hooks, deleting something
  no story brooms out), STOP: return status "blocked" with the exact question. Do not
  improvise.
- Grep before read; read ranges not whole files; return the CONTRACT only. Your final
  message is parsed by a machine - no prose walls.
- YOU ARE THE EXECUTOR, NOT A DISPATCHER. Do the work yourself with foreground tools.
  Do NOT spawn sub-agents, do NOT dispatch background workers, do NOT wait for
  phantom agents. A dev/PB server may be ONE background process each; kill what you
  start unless the story says to leave it.

## Lynx crib sheet (verified against the PLAN; official docs are the tiebreaker)

- Build: @lynx-js/rspeedy (Rspack). Scaffold: `npm create rspeedy@latest` with
  non-interactive flags. Web output runs via @lynx-js/web-core / web-elements host.
- Framework: @lynx-js/react (ReactLynx, React-17-style API, Preact-based) +
  @lynx-js/react/compat for React-18 APIs (startTransition).
- Elements, not HTML: <view> <text> <image> <scroll-view> <list> <input>. TEXT DOES
  NOT INHERIT CSS - set color/font-family/size explicitly on every <text>.
- Styling: Tailwind v3 + @lynx-js/tailwind-preset + rsbuild-plugin-tailwindcss. CSS
  variables, gradients, box-shadow supported. No pseudo/data-attr selectors - use the
  preset's uiVariants for states. Keep the token names (--paper, --ink, --leaf,
  --zest, --radius-card, .shadow-soft, ...).
- Animation: CSS transitions/keyframes for enter/exit; Main-Thread Scripting (MTS)
  for gesture-linked motion: 'main thread' directive, main-thread:bind events,
  event.currentTarget.setStyleProperty, useMainThreadRef. MTS constraints: captured
  vars JSON-serializable, runs only after TTI, no nested defs, cannot mutate
  outer-scope vars.
- Routing: TanStack Router with MEMORY history (no History API) +
  url-search-params-polyfill.
- Data: pocketbase SDK wired to Lynx fetch + lynx.EventSource. PrimJS lacks
  TextEncoder/TextDecoder (native-only concern; web target uses the browser's).
- SVG: Lynx <svg> element (v3.7+). Doodles = record strokes as path d via MTS.
- Fonts: @font-face IGNORES font-weight/style - one family name PER weight instance
  (e.g. "Outfit-600"), static @fontsource packages, or lynx.addFont.
- localStorage does not exist: use the storage adapter seam from unit 1.4.
- Docs: https://lynxjs.org/rspeedy/ , /guide/start/quick-start , /rspeedy/styling ,
  /react/routing/tanstack-router , /guide/interaction/networking ,
  /react/main-thread-script , /api/css/at-rule/font-face.html
- Little Lynx knowledge exists in model training data: when an API is uncertain,
  FETCH THE DOC PAGE, do not guess.

## Story file template (used by every unit)

  # <unit-id> - <title>            e.g. "1.4 - PocketBase client seam"
  LAYER / TIER / RISK: ...
  GOAL: one sentence.
  CONTEXT: what exists when this unit starts (which units precede it).
  IN SCOPE (files): old files to port/broom (exact paths) + new files to create.
  OUT OF BOUNDS: explicit.
  BROOM: what does NOT come over, and why (recorded, deliberate).
  SPEC: numbered, concrete steps; PLAN section references; Lynx crib references.
  DONE MEANS: the mechanical gate (commands + expected results + E2E tag if any).
  PARKED: anything this machine cannot verify (explicit list, may be empty).

## Top-brain rulings (pre-answered STOPs; these override story-level uncertainty)

R1  HABITS: recurring habits do NOT exist in the current client (pb_migrations/
    006_tasks_reset.js dropped the collections; Task has no cadence/target fields).
    They are OUT of this run's scope - building them means pb_migrations changes
    (HIGH-RISK, forbidden). Record as an explicit parity gap in 8.4. Parity means
    parity with today's app.
R2  GOOGLE EVENTS: the current client renders no calendar_events, but rendering them
    read-only needs NO schema change and is required by CLAUDE.md locked feature 6 +
    PLAN Phase 5 gate. Unit 5.3 builds it (read-only, superuser-seeded fixtures).
    4.1 keeps the AgendaExternal/extern seam with an empty default; no L4 unit
    brooms that seam away.
R3  DRAG BOUNDARY: ALL pointer drags (timebox drag/resize, AgendaSheet reorder,
    ComposerSheet drag-dismiss) belong to unit 5.2. L4 ships the sheet UI without
    drags.
R4  L4 LAND ORDER: 4.2 -> 4.3 -> 4.1 (intra-layer dependencies; the harness lists
    them in this order).
R5  SEAMS: 1.3 creates minimal lib/pb.ts + lib/useCollectionLive.ts with stable
    exported shapes; 1.4 rewrites them in place. packs.ts and backdrop.ts belong to
    1.3 (PLAN section 3 mislabels them as pure logic). DOM lib types are allowed in
    the new tree for web-target code; native equivalents are PARKED.
R6  SCAFFOLD COMMAND: the Spike phase must record the exact working create-rspeedy
    invocation and web-output config in its findings note (appended to the PLAN);
    unit 1.1 reuses it verbatim instead of re-verifying flags.
R7  FILE PICKING (attachments-add 4.2, backdrop custom image 3.4): attempt on the
    web target; the FIRST unit to hit it records the capability finding in its
    result and the other reuses it. If impossible on Lynx web, ship read-only +
    record a parity gap. Do NOT block a layer on it. Native file picking is PARKED.
R8  PRIMITIVES SCOPE: 2.3 ports ALL FOUR surface.tsx exports (Panel, Eyebrow,
    StampButton, Stamp) - five later stories depend on the stamps.
R9  MTS TOUCH UNDER PLAYWRIGHT: the Spike must specifically prove/disprove that
    Playwright-synthesized touch/pointer input reaches main-thread:bindtouch*
    handlers on the web target and record the working recipe. If synthetic input
    cannot reach MTS handlers, drag/draw specs (5.2, 7.2, 7.3) assert persisted
    post-gesture state via the best available simulation and say so honestly, or
    the unit returns blocked - never a faked green.
R10 SPIKE PHASE: the Phase 0 spike is a HARNESS phase, not a story file. It appends
    "## Phase 0 spike findings (this run)" to docs/lynx-migration.md before L1
    executes; stories that reference spike findings read them there.

## End state

Branch lynx/migration in the worktree: new Lynx app with web parity, E2E suite green,
Capacitor gone, old src/ broomed with a written record, CLAUDE.md updated,
docs/lynx-run/run-manifest.json written, digest delivered. The OPERATOR pushes,
opens the PR, and does anything requiring macOS/Android tooling or store accounts.
