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

## Current state (updated 2026-07-26)

**Keep this section true.** Update it before you end a session. It is the only place that records
where things actually stand, and it is what spares the next session from re-reading the repo.

- **Branch** `feat/expo-migration`, working tree clean.
- **Shipped in `frontend/`**: auth and onboarding, Home (a user-arranged widget stack), Planner
  (week/month/agenda views, timeboxing, compose sheet), Boards, Projects (learning programs as
  folders), Account, the Style studio (runtime palette, fonts, backdrops, doodle icons), and Gym.
- **Home is now the first tab** (`frontend/src/app/(tabs)/index.tsx`): a user-arranged widget stack
  (schedule, tasks, gym) with an arrange mode off the masthead pencil (hold to reorder, tap the eye
  to hide — the same convention as `ArrangeList`'s dock editor) and the compose FAB. Planner moved
  to `(tabs)/planner.tsx` and now opens on Week; its old today view is retired in Home's favour, no
  planner capability lost. The dock is user-configurable from Account's **"Your dock"** panel:
  reorder or hide any space except Home and Account, which stay pinned so you can never lock
  yourself out. Order and hidden set live in the `users.shell` JSON field (migration 029), synced
  like the Style store; both tab bars render from the same resolved list (`useDock()`), and native
  builds register a `NativeTabs.Trigger` for every space even when it's hidden from the dock, plus a
  focused-space guard, since a route the tab navigator can't find a trigger for throws. Full spec:
  [docs/superpowers/specs/2026-07-26-home-dock-food-journal-design.md](docs/superpowers/specs/2026-07-26-home-dock-food-journal-design.md) —
  phase 1 (this work) is done; phase 2 (capture bar, inbox, search) and phase 3 (the Food Journal
  widget) are next.
- **A jest-expo test rig now exists**: `cd frontend && npm test` runs 15 tests (pure shell-layout
  arithmetic, plus `SPACES`/`resolveDock`/`spaceFor`). First tests in `frontend/`.
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
- **In flight**: the Gym redesign specced in [frontend/docs/gym-ux-plan.md](frontend/docs/gym-ux-plan.md).
  The root problem to fix first: the routine editor collects sets, reps, weight and rest, but
  `useStartWorkout` builds every set from `emptySet()` and discards `target_reps` and
  `target_weight` ([frontend/src/features/workouts/api.ts](frontend/src/features/workouts/api.ts)), so
  the catalog's real rep schemes never reach a session and progressive overload stays passive.
- **Not built**: Journal (food log), Google Calendar two-way sync, Google OAuth sign-in.
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

1. **Home** (`index`): the front door. A user-arranged widget stack (schedule, tasks, gym today) —
   everything due today, actionable in place, no drill-in required.
2. **Planner**: week, month and agenda views, timeboxing, opens on Week. Its old today view moved
   to Home; nothing else about it changed.
3. **Boards**: free-form mood boards (notes, text, links, photos, stickers, doodles, sections) on
   a pannable, zoomable canvas with a freehand ink layer. See
   [frontend/docs/boards.md](frontend/docs/boards.md).
4. **Projects**: learning programs as file-folder cards.
5. **Gym**: programs, routines, live logging, history.
6. **Account**.

**The dock is user-composable**, not fixed. Reorder or hide any space but Home and Account from
Account's "Your dock" panel (`frontend/src/features/home/components/DockPanel.tsx`); the resolved
order comes from `useDock()` in `frontend/src/features/home/store.ts`. Native builds get the
platform's own tab bar (`NativeTabs` from `expo-router/unstable-native-tabs`) — every space
registers a trigger whether it's in the dock or not, so a hidden space stays reachable by deep link
or from a Home widget — and the hand-drawn page doodles are rasterized off-screen into bitmap icons
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
start` once to let Metro regenerate it, then re-run typecheck. Recurred twice moving Planner to
`/planner` and adding Home during the Home/dock work above.

**`backend/pb_data` is live user data.** Never delete, reset or hand-edit it. Schema changes go through
`backend/pb_migrations/`.

---

## Data (PocketBase)

Collections, all owner-scoped: `users`, `tasks`, `moodboards`, `routines`, `workouts`,
`workout_programs`, `learning_programs`.

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
`project/[id]`, `routine/[id]`, `workout/[id]`, `board/[id]`, `preferences`, `style`, `wordmark`,
and at the root `compose`, `login`, `onboarding`.

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
