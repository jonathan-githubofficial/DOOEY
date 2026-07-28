# DOOEY: Project Guide for Claude

DOOEY is a **personal life OS**: today's tasks, recurring habits, gym training, mood boards, and
learning programs in one tactile, playful app.

It is built **for one user (the owner) now**, but every record keeps multi-user data isolation
(`owner` fields plus PocketBase rules), so opening it up as a SaaS later is a config change, not a
rewrite. No sharing or visibility UI until then.

> **The app is [frontend/](frontend/), an Expo app, and it is now the only app.** It ships to iOS,
> Android *and* the web from one codebase. The Vite web app that used to live in root `src/` was
> deleted on 2026-07-25; see [One app, three targets](#one-app-three-targets).

This file is the canonical entry point. Deeper docs live in [docs/](docs/) and
[frontend/docs/](frontend/docs/).

---

## Current state (updated 2026-07-27)

**Keep this section true.** Update it before you end a session. It is the only place that records
where things actually stand, and it is what spares the next session from re-reading the repo.

- **Branch** `feat/expo-migration`, working tree clean.
- **Shipped in `frontend/`**: auth and onboarding, Planner (list/timeline/week views, timeboxing,
  compose sheet), Boards, Projects (learning programs as folders), Journal (food log), Account,
  the Style studio (runtime palette, fonts, backdrops, doodle icons), Gym, and Rituals.
- **The Planner is the home page** (`frontend/src/app/(tabs)/index.tsx`). The separate Home widget
  stack was removed on 2026-07-27: it duplicated the planner's today view without adding anything.
  Its mode toggle is grouped by span — `List` and `Timeline` are one day drawn two ways, `Week` is
  a different span, and a divider in the toggle says so. The month unfolds out of the date shelf
  rather than being a fourth mode, and `WeekStrip` takes a `compact` prop so Week mode doesn't
  print the seven days twice. The dock stays user-configurable from Account's **"Your dock"**
  panel: reorder or hide any space except Planner and Account, which stay pinned so you can never
  lock yourself out. Order and hidden set live in the `users.shell` JSON field (migration 029).
- **A jest-expo test rig exists**: `cd frontend && npm test` runs 71 tests — shell-layout
  arithmetic, `SPACES`/`resolveDock`/`spaceFor`, the ritual schedule engine, the muscle-figure
  mapping tables, tag parsing, and the compose sheet's presentation options.
- **The iOS launch crash is fixed** (2026-07-27). `timing()` in `frontend/src/lib/motion.ts` was a
  plain function called from five UI-thread worklets, one of them `ArrangeList`'s `useAnimatedStyle`
  — which runs on mount, and iOS instantiates every tab at once, so signing in aborted the process
  (`throwPendingError → __cxa_throw → SIGABRT`, uncatchable by any JS error boundary). `timing()`
  now carries a `"worklet"` directive. **If you add a helper that a worklet calls, it needs one
  too**; nothing in the type system will tell you.
- **Boards was rebuilt on 2026-07-25** to replace the old web version: every web feature except
  folders, direct-manipulation editing with no dialogs, undo/redo, and a Skia ink layer so drawing
  keeps up with a hand. Architecture and the reasoning behind each tool:
  [frontend/docs/boards.md](frontend/docs/boards.md). **This added
  `@shopify/react-native-skia`, a native module: the dev client has to be rebuilt** before the
  Boards space will run on a device, and `npm install` must have run at least once since, because
  its `postinstall` is what puts CanvasKit's wasm where the web build can serve it
  (`frontend/scripts/copy-canvaskit.mjs`). The canvas has not yet been exercised signed-in on either
  target.
- **Gym is the active feature and the largest one**: program catalog, routine editor, live logger
  with a docked keypad and Start/Stop per set, history, muscle map. Architecture:
  [frontend/docs/gym.md](frontend/docs/gym.md).
- **The gym's hero is one ticket** (2026-07-28,
  `frontend/src/features/workouts/components/TrainingTicket.tsx`). It replaced `WeekPanel` and
  `UpNextCard`, two Panels stacked with a gap that never said they were a pair: the counterfoil
  above the perforation is the record (`1 of 4 days this week`, the week's keys, the muscles it
  hit), the stub below it is the instruction in the routine's own hue (what to train, and the
  page's only Start). The stub has four states as a `TicketNext` union — live session, next
  routine, invitation, waiting — so "you own no routines" is *an answer* rather than a hole in the
  card. It is drawn as real ticket furniture: a **stamp-cut silhouette** (a scallop out of every
  edge, a fold notch where the tear meets each side, perforation between them, all on
  `stamp-edge.tsx`'s numbers), tracked uppercase captions in tabular figures over every value, and
  art that bleeds off the paper (the counterfoil's figures stand in a plate tinted with the hue the
  week came out; the stub's run off the bottom edge). **No barcode** — it would encode nothing,
  which is the decoration-without-a-job a metaphor is not allowed to be here. **Every bite is paper
  painted on top, not a real cutout**: a mask would stop the colour fields reaching the card's
  edges, and would cost the shadow on Android, where elevation follows a view's bounds and not its
  paint. **The tear is split between the halves rather than straddling them**, so neither paints
  outside its own box and no platform's overflow or z-order rules can break it. History left
  the card for `(detail)/history.tsx`: how this week is going and what you have done since January
  are different questions, and the second was never a state of the first.
- **The muscle figures were wrong until 2026-07-27**, in three ways, all now fixed and tested
  (`frontend/src/features/workouts/anatomy.test.ts`). (1) `exercises.json` had been hand-built
  without upstream's `secondaryMuscles`, so every exercise had exactly one muscle — a bench press
  was chest and nothing else. It is now generated by `frontend/scripts/build-exercise-library.mjs`
  from the same pinned SHA as the GIFs. (2) Each muscle was mapped to one side of the body, so
  shoulders, forearms, calves, triceps, traps and adductors could never light on half the figure;
  which side a part shows on is now read from the library's own assets. (3) `MuscleMap` picked one
  side and silently dropped the rest, so a squat showed quads and forgot the glutes. **Add a muscle
  name and the mapping tables in `anatomy.ts` are the only place to touch** — every figure renders
  through `WeekBody` now.
- **In flight**: the Gym redesign specced in [frontend/docs/gym-ux-plan.md](frontend/docs/gym-ux-plan.md).
  Its root problem is fixed — `useStartWorkout` now instantiates each set from the routine's
  `target_reps`/`target_weight` instead of `emptySet()`, so a catalog rep scheme reaches the logger.
  Steps 1 to 4 and the training ticket are done; what is left is persisting the live timers and the
  shared plan/perform visual language.
- **Rituals tie the spaces together** (2026-07-27, `frontend/src/features/rituals/`). A ritual is a
  standing commitment — a routine on chosen weekdays at chosen times, or meals once or several
  times a day — and its slots lay themselves out on all three planner views, styled per kind: a
  training slot wears its routine's card hue and emblem and its play disc starts the session from
  the planner; a meal slot is honey and opens the Journal. **Nothing records whether a slot was
  kept.** `useDayRituals` derives that by joining the schedule against the workouts and journal
  entries that already exist, so deleting a session un-keeps its slot. Each slot owns a *band* (to
  the midpoints between neighbouring times), which is what lets three meal slots resolve
  independently against one flat list of entries. Schedules live in `users.rituals` (migration 031)
  and sync exactly like `users.shell`. Edited on Preferences, under **Rituals**.
- **Two migrations are written but NOT applied**: `030_journal_entries` and `031_users_rituals`.
  PocketBase runs them on start, so both land on the next `backend/pocketbase.exe serve`. Until
  then the Journal cannot read or write, and ritual schedules stay device-local (the sync PATCH
  fails on the unknown field and is swallowed).
- **Not built**: Google Calendar two-way sync, Google OAuth sign-in.
- **Design system**: retargeted to `frontend/` on 2026-07-25.
  [docs/design-system.md](docs/design-system.md) and [docs/design-audit.md](docs/design-audit.md)
  now describe this app, built on "you own it" and "motion has to do a job". New:
  `frontend/src/lib/motion.ts` (durations, easings, four gesture springs) and `useElevation()` in
  `frontend/src/stores/theme.ts`. The audit's worklist is unstarted: 21 hardcoded `shadowColor`
  sites, 34 hex literals, 14 card radii the slider cannot move, 6 springs that visibly bounce.
- **Two folders now: `frontend/` and `backend/`** (2026-07-26). Was `mobile/` and `pb/`. Also gone:
  the 414MB Lynx worktree in `.worktrees/`, the dead lynx plugins in `.claude/settings.json`, a
  `mobile/.claude/` that only enabled the Expo plugin, a committed `settings.local.json` full of
  another machine's paths, and `.scratch/` + `test-results/` + `.playwright-mcp/`.
- **The Vite web app is gone** (2026-07-25). `materializeProgram` was ported into
  `frontend/src/features/learning/api.ts` first, so pushing a learning program is end to end again.
  The Docker image now builds the Expo web export. See [One app, three targets](#one-app-three-targets).

---

## The spaces

Six spaces behind the tab bar, declared in
[frontend/src/lib/spaces.ts](frontend/src/lib/spaces.ts) (`SPACES`) and rendered by both tab bars
from [frontend/src/app/(tabs)/_layout.tsx](frontend/src/app/(tabs)/_layout.tsx):

1. **Planner** (`index`): the front door and the calendar in one. List, Timeline and Week views,
   timeboxing, the month unfolding out of the date shelf, and the day's ritual slots laid out
   above the tasks.
2. **Boards**: free-form mood boards (notes, text, links, photos, stickers, doodles, sections) on
   a pannable, zoomable canvas with a freehand ink layer. See
   [frontend/docs/boards.md](frontend/docs/boards.md).
3. **Projects**: learning programs as file-folder cards.
4. **Gym**: programs, routines, live logging, history.
5. **Journal**: what you ate, in your own words, grouped by daypart. Never parsed, by design.
6. **Account**.

**The dock is user-composable**, not fixed. Reorder or hide any space but Planner and Account from
Account's "Your dock" panel (`frontend/src/features/home/components/DockPanel.tsx`); the resolved
order comes from `useDock()` in `frontend/src/features/home/store.ts`. Native builds get the
platform's own tab bar (`NativeTabs` from `expo-router/unstable-native-tabs`) — every space
registers a trigger whether it's in the dock or not, so a hidden space stays reachable by deep
link or from a ritual slot on the planner — and the hand-drawn page doodles are rasterized off-screen into bitmap icons
when "doodle icons in dock" is on. The web build keeps the DOOEY dock island
(`frontend/src/components/Dock.tsx`) behind a `Tabs` that likewise registers all six screens
regardless of dock membership.

**Tasks are pages, not rows.** Every task opens its own page with fixed, well-designed sections:
notes, checklist, resources (links and video embeds), attachments. Notion-ish depth, but structured,
with no free-form block editor.

Calendar is no longer its own space: week, month and agenda views live in
`frontend/src/features/tasks/components/`.

---

## Stack (locked)

| Layer | Choice |
|---|---|
| Runtime | Expo SDK 54, React Native 0.81, React 19.1 |
| Routing | expo-router 6, file-based, typed routes on |
| Compiler | React Compiler enabled (`app.json` → `experiments.reactCompiler`) |
| Server state | TanStack Query v5 plus the PocketBase JS SDK |
| Client state | Zustand v5, persisted through AsyncStorage |
| Animation | react-native-reanimated 4 with react-native-worklets |
| GPU canvas | `@shopify/react-native-skia`, the Boards ink layer only |
| Styling | React Native `StyleSheet` with tokens in `features/style/tokens.ts`. No Tailwind, no NativeWind, no shadcn, no UI kit |
| Fonts | Outfit (body) and Fraunces (display) via `@expo-google-fonts/*` |
| Icons | `lucide-react-native`, `@expo/vector-icons`, plus the user's own doodles |
| Native | expo-haptics, expo-image-picker, expo-video, expo-audio, expo-file-system, react-native-view-shot |
| Backend | PocketBase (Go binary in `backend/`): API, realtime, auth |
| Builds | EAS (`frontend/eas.json`), app id `com.dooey.app` |

`frontend/patches/` holds patch-package patches applied on `postinstall` (one keeps native tab icons
from being tinted as templates). If a patched package misbehaves, read the patch before blaming the
library.

**Do not add** without asking: NativeWind or Tailwind, a component kit, a second data-fetching or
state library, i18n, a system theme, a third font, react-navigation used directly instead of
expo-router, a block-editor library.

---

## Running it

```bash
backend/pocketbase.exe serve          # backend on :8090, start this first
cd frontend && npm start           # Metro, then press i, a or w
cd frontend && npm run typecheck   # tsc --noEmit
cd frontend && npm run lint
```

`frontend/src/lib/pb.ts` derives the API host from Expo's `hostUri` in dev, so phones, emulators and
the web all find PocketBase with no config. Production builds set `EXPO_PUBLIC_PB_URL`.

**`frontend/.expo/types/router.d.ts` goes stale after a route rename or move** (it's expo-router's
own gitignored typed-routes cache, and a debounced regeneration can land mid-edit). When that
happens `npm run typecheck` fails with `Type '"/"' is not assignable to type ...` at `<Redirect>`/
`router.replace` call sites in `login.tsx`, `onboarding.tsx` or `compose.tsx` that were never
touched. It is not a code bug: delete the file (or all of `frontend/.expo/`) and run `npx expo
start` once to let Metro regenerate it, then re-run typecheck. Recurred moving Planner between
`/planner` and `/` and adding the Journal route.

**`backend/pb_data` is live user data.** Never delete, reset or hand-edit it. Schema changes go through
`backend/pb_migrations/`.

---

## Data (PocketBase)

Collections, all owner-scoped: `users`, `tasks`, `moodboards`, `routines`, `workouts`,
`workout_programs`, `learning_programs`, `journal_entries`.

Two things live on the `users` record rather than in a collection of their own, because the client
always reads them whole and they belong to the account: `shell` (dock order and hidden set) and
`rituals` (the recurring schedules the planner lays out).

- **Data isolation** is enforced server-side by PocketBase rules (`owner = @request.auth.id`). The
  client trusts what PB returns.
- Routine and workout bodies are **JSON blobs**, not join tables.
- The **live gym session is derived** (`!ended_at`), never a flag, and clocks derive from timestamps
  so backgrounding the app cannot drift them.
- **Timestamps** are stored UTC and rendered in the user's timezone.
- Tasks belonging to a learning program carry `project`, `gate` and `session_key`.

Full gym data model: [frontend/docs/gym.md](frontend/docs/gym.md), section "Server collections".

---

## Auth and sessions

Every space sits behind a guard; `/login` is the only public route.

- `(tabs)/_layout.tsx` redirects signed-out visitors to `/login`. `onboarding.tsx` runs for new
  accounts.
- The session persists through PocketBase's `AsyncAuthStore` over AsyncStorage. **`authLoaded`
  (`frontend/src/lib/pb.ts`) must resolve before auth state means anything**: await it, do not race it.
- Google OAuth is on the roadmap and not wired yet.

---

## Design

The aesthetic is **clean skeuomorphism, "tactile objects"**: real-world metaphors where they earn
their keep, calm surfaces everywhere else. Simple yet breathtaking, fun and playful, never silly.
Depth comes from soft light, not bevels or gloss. Tasks are paper cards, learning programs are file
folders, toggles and checks feel spring-loaded. A metaphor must clarify what a thing *is* or *does*;
decoration alone does not justify one. Type is Fraunces for display (wordmark, space titles, big
numbers) and Outfit for everything else, with uppercase tracked eyebrows.

**You own it.** The Style page is not a settings screen bolted on the side; it is the point of the
app. The user picks the palette, the fonts, the corner radius, the shadow depth, the grain, the
backdrops, the doodles on their tab icons. So: **a hardcoded value is a value stolen from the user.**
A literal `"#282018"` is a corner of the app they cannot reach, still wearing the factory theme after
they have made everything else theirs. Before typing a value, ask whose decision it is.

**Motion has to do a job**, and there are three: follow the finger (drag, swipe, scroll), explain a
change (something moved and you would otherwise have to re-find it), confirm an action (the press
dip, the tick). Anything doing none of them does not animate. The test is *what would the user lose
if this were instant?*, and for most of the app the answer is nothing.

**Nothing wobbles.** Springs are for gestures only, because a finger is driving them. Everything else
is a short timing curve, 220ms ceiling. Every spring is near-critically damped: the damping ratio
`damping / (2 * sqrt(stiffness * mass))` must be **0.8 or above**, and the design checker enforces it.
Decorative bounce, stagger for its own sake, and overshoot-because-it-is-fun are not part of the
language. A notebook does not wobble when you write in it.

The values behind all that live in tokens:

| Concern | Owner |
|---|---|
| Palette, fonts, presets, backdrops, doodle pages | `frontend/src/features/style/tokens.ts` |
| `Palette` type, `alpha()`, `relight()` | `frontend/src/lib/theme.ts` |
| Live palette, type, elevation (`usePalette`, `useType`, `useElevation`) | `frontend/src/stores/theme.ts` |
| Radius and shadow strength (`useCardRadius`, `useShadow`) | `frontend/src/features/style/store.ts` |
| Durations, easings, gesture springs | `frontend/src/lib/motion.ts` |
| Shared primitives (surface, plate, sheet, stamp-edge, grain, pressable-scale, Check) | `frontend/src/components/` |

**If a value appears in two components, it belongs in a token.**

Full rules: [docs/design-system.md](docs/design-system.md). Known drift and the migration order:
[docs/design-audit.md](docs/design-audit.md). The `design-system` skill
(`.claude/skills/design-system/`) loads both and checks a diff against them, including computing
damping ratios; `/design-check` runs it.

---

## Repository layout

```
DOOEY/
├── CLAUDE.md                 ← you are here
├── Dockerfile                ← builds frontend, bundles it with the backend as one image
├── frontend/                 ← THE APP: Expo, and the only app. iOS, Android, web.
│   ├── app.json              ← Expo config (plugins, icons, typed routes)
│   ├── eas.json              ← build profiles
│   ├── patches/              ← patch-package patches, applied on postinstall
│   ├── scripts/              ← copies CanvasKit's wasm into public/ on postinstall
│   ├── public/               ← served at the web root (canvaskit.wasm lands here)
│   ├── docs/boards.md        ← the boards canvas, end to end
│   ├── docs/gym.md           ← gym architecture, UI and logic
│   ├── docs/gym-ux-plan.md   ← the in-flight gym redesign
│   └── src/
│       ├── app/              ← expo-router routes
│       ├── components/       ← shared primitives (Dock, sheet, plate, surface, doodles)
│       ├── features/         ← tasks, workouts, boards, learning, style, auth
│       ├── lib/              ← pb, theme, dates, haptics, sounds, doodle, confirm, shell
│       └── stores/           ← auth, theme, sheet, garden (Zustand)
├── backend/                  ← PocketBase: binary, pb_hooks, pb_migrations, pb_data
│                               (pb_data is live personal data — never delete, reset or hand-edit)
├── docs/                     ← design system, deploy runbook, learning programs
├── scripts/                  ← learning-program verify and push (the only root code)
└── ref/                      ← design reference documents
```

Two folders, named for what they are. It used to be `mobile/` and `pb/`, which stopped being true
once `mobile/` started shipping the web build too. Renamed 2026-07-26; the container path inside the
image is still `/pb`, because that is PocketBase's own convention and the volume mount depends on
it.

Routes in `frontend/src/app/`: `(tabs)/` for the six spaces, `(detail)/` for `task/[id]`,
`project/[id]`, `routine/[id]`, `workout/[id]`, `board/[id]`, `tag/[tag]`, `history`,
`preferences`, `style`, `wordmark`, and at the root `compose`, `login`, `onboarding`.

A feature's code lives **entirely** inside `frontend/src/features/<feature>/`: `components/` for its
UI, `api.ts` for its PB queries and mutations, `types.ts`, `store.ts` when it needs one. If two
features reach for the same thing, it moves to `frontend/src/lib/` or `frontend/src/components/`.
Folders are created when a feature needs them, never pre-created empty.

---

## One app, three targets

There used to be two apps: the Expo app in `frontend/` and a separate Vite web app in root `src/`
(React 19, TanStack Router, Tailwind v4, shadcn/ui, `motion/react`). **The Vite app was deleted on
2026-07-25.** It shared no code with `frontend/`, every new feature had to be built twice, and by the
end `frontend/` was a strict superset of it — same five features plus Gym.

`frontend/` now serves the web too, through React Native Web. The web build is a plain
`expo export --platform web`, copied into `pb_public` so PocketBase serves the API and the app from
one container ([Dockerfile](Dockerfile), [docs/deploy-google-cloud.md](docs/deploy-google-cloud.md),
auto-deploy in [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

Three things worth knowing about that trade:

- **The web bundle is bigger.** 1.37MB gzipped against the Vite app's 206KB. Accepted knowingly: a
  single-user app behind a login, opened daily and cached, with nothing that should ever be indexed.
- **`web.output` stays `"single"`.** Not `"static"`: static rendering wants `generateStaticParams`
  for dynamic routes, and `board/[id]`, `task/[id]`, `workout/[id]` and the rest are all user data.
  PocketBase falls back to `index.html`, so the client router resolves deep links.
- **On the web the API is the page's own origin** (`frontend/src/lib/pb.ts`), because PocketBase is
  what served it. Only native builds need `EXPO_PUBLIC_PB_URL`.

Root now holds the container, `frontend/`, `backend/`, `docs/`, and `scripts/` for the
learning-program tooling. Its `package.json` has one dependency.

[docs/roadmap.md](docs/roadmap.md) and [docs/architecture.md](docs/architecture.md) predate all of
this and describe the deleted web app. Read them as history, not as the plan.

---

## Learning programs

Programs built with the **learning-architect** skill are verified and pushed straight into
PocketBase, never hand-imported:

```bash
npm run verify-program -- <dir>
npm run push-program   -- <dir>
```

Full procedure and file formats: [docs/learning-programs.md](docs/learning-programs.md). Sessions
become tasks in the app now (`useMaterializePrograms`, mounted on the Projects tab), so push then
open Projects and the work is there.

---

## Philosophy

- **Feature by feature.** One feature lands fully before the next starts. No half-finished stubs, no
  "coming soon" pages, no scaffolding for hypothetical phases.
- **Simple first, smart later.** Ship the dumb version that works. Add intelligence (smart
  suggestions, ranking, LLM augmentation) only once the basics earn it.
- **Personal now, SaaS-ready.** One real user, but `owner` plus server rules is never skipped.
- **Getting around is effortless.** One tab bar, one tap to any space. Depth (task pages, board
  canvas, routine and workout pages) is drill-in and back, never a maze.

---

## Code quality rules

**No dead code.** Delete unused imports, variables and functions immediately. Do not comment code
out; git remembers. No `TODO` or `FIXME` in committed code: fix it or open an issue. No placeholder
functions or "coming soon" blocks.

**Fix the root cause.** When something breaks, find the actual cause. Do not add a guard for an
impossible case, do not swallow errors, do not paper over.

**Trust the boundaries.** Validate at user input and external API edges only. Do not defensively
re-check what internal code already guarantees.

**Comments only when the *why* is non-obvious.** Code explains what; comments explain why this
surprising thing.

**No em dashes.** Not in UI copy, comments, docs, or commit messages. Use a colon, a semicolon, a
comma, or two sentences. (A bare `—` standing in for a missing value in a stat or table cell is a
glyph, not punctuation, and stays.)

**TypeScript strict.** Narrow types; `any` is a code smell, not a tool.

---

## Conventions

- **One store per domain** in `frontend/src/stores/` (`auth`, `theme`, `sheet`, `garden`), except
  feature-isolated stores, which live in the feature folder (`features/workouts/store.ts`,
  `features/style/store.ts`).
- **Three kinds of state, never blurred**: server state is TanStack Query, preferences are Zustand
  plus AsyncStorage, static data is bundled (the exercise library and the program catalog).
- **Theme** is light and dark only. No system theme. Light is the default.
- **Autosave, no save buttons.** The gym feature has none anywhere; new surfaces match.

---

## What to read next

1. [frontend/docs/gym.md](frontend/docs/gym.md): the current app's deepest feature, end to end.
   [frontend/docs/boards.md](frontend/docs/boards.md) is the second, and the one to read for how a
   direct-manipulation surface is put together here.
2. [frontend/docs/gym-ux-plan.md](frontend/docs/gym-ux-plan.md): what we are fixing right now, and why.
3. [docs/design-system.md](docs/design-system.md): the tokens, the ownership rule, and the motion rules.
