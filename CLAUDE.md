# DOOEY: Project Guide for Claude

DOOEY is a **personal life OS**: today's tasks, recurring habits, gym training, mood boards, and
learning programs in one tactile, playful app.

It is built **for one user (the owner) now**, but every record keeps multi-user data isolation
(`owner` fields plus PocketBase rules), so opening it up as a SaaS later is a config change, not a
rewrite. No sharing or visibility UI until then.

> **The app is [mobile/](mobile/), an Expo app.** The Vite web app in `src/` is frozen legacy
> (last commit 2026-07-18). Work in `mobile/` unless told otherwise, and read
> [Legacy web app](#legacy-web-app-frozen) before touching anything outside it.

This file is the canonical entry point. Deeper docs live in [docs/](docs/) and
[mobile/docs/](mobile/docs/).

---

## Current state (updated 2026-07-25)

**Keep this section true.** Update it before you end a session. It is the only place that records
where things actually stand, and it is what spares the next session from re-reading the repo.

- **Branch** `feat/expo-migration`, with a large uncommitted working tree (about 37 files, mostly
  gym plus its docs).
- **Shipped in `mobile/`**: auth and onboarding, Planner (tasks, week/month/agenda views,
  timeboxing, compose sheet), Boards, Projects (learning programs as folders), Account, the Style
  studio (runtime palette, fonts, backdrops, doodle icons), and Gym.
- **Gym is the active feature and the largest one**: program catalog, routine editor, live logger
  with a docked keypad and Start/Stop per set, history, muscle map. Architecture:
  [mobile/docs/gym.md](mobile/docs/gym.md).
- **In flight**: the Gym redesign specced in [mobile/docs/gym-ux-plan.md](mobile/docs/gym-ux-plan.md).
  The root problem to fix first: the routine editor collects sets, reps, weight and rest, but
  `useStartWorkout` builds every set from `emptySet()` and discards `target_reps` and
  `target_weight` ([mobile/src/features/workouts/api.ts](mobile/src/features/workouts/api.ts)), so
  the catalog's real rep schemes never reach a session and progressive overload stays passive.
- **Not built**: Journal (food log), Google Calendar two-way sync, Google OAuth sign-in.
- **Design system**: retargeted to `mobile/` on 2026-07-25.
  [docs/design-system.md](docs/design-system.md) and [docs/design-audit.md](docs/design-audit.md)
  now describe this app, built on "you own it" and "motion has to do a job". New:
  `mobile/src/lib/motion.ts` (durations, easings, four gesture springs) and `useElevation()` in
  `mobile/src/stores/theme.ts`. The audit's worklist is unstarted: 21 hardcoded `shadowColor`
  sites, 34 hex literals, 14 card radii the slider cannot move, 6 springs that visibly bounce.
- **Loose ends**: `src/lib/motion.ts`, `src/components/sheet.tsx` and the uncommitted edits to
  `src/main.tsx` and `src/styles/global.css` were written for the **frozen web app** in the same
  pass, before it was clear it had been superseded. Delete or ignore; do not port them, their
  motion philosophy is the one the current system replaces.

---

## The spaces

Five spaces behind the tab bar, declared in
[mobile/src/app/(tabs)/_layout.tsx](mobile/src/app/(tabs)/_layout.tsx):

1. **Planner** (`index`): everything due today in one glance, plus week, month and agenda views.
2. **Boards**: free-form mood boards (sticky notes, text, links, stickers, doodles).
3. **Projects**: learning programs as file-folder cards.
4. **Gym**: programs, routines, live logging, history.
5. **Account**.

Native builds get the platform's own tab bar (`NativeTabs` from
`expo-router/unstable-native-tabs`), and the hand-drawn page doodles are rasterized off-screen into
bitmap icons when "doodle icons in dock" is on. The web build keeps the DOOEY dock island
(`mobile/src/components/Dock.tsx`).

**Tasks are pages, not rows.** Every task opens its own page with fixed, well-designed sections:
notes, checklist, resources (links and video embeds), attachments. Notion-ish depth, but structured,
with no free-form block editor.

Calendar is no longer its own space: week, month and agenda views live in
`mobile/src/features/tasks/components/`.

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
| Styling | React Native `StyleSheet` with tokens in `features/style/tokens.ts`. No Tailwind, no NativeWind, no shadcn, no UI kit |
| Fonts | Outfit (body) and Fraunces (display) via `@expo-google-fonts/*` |
| Icons | `lucide-react-native`, `@expo/vector-icons`, plus the user's own doodles |
| Native | expo-haptics, expo-image-picker, expo-video, expo-audio, expo-file-system, react-native-view-shot |
| Backend | PocketBase (Go binary in `pb/`): API, realtime, auth |
| Builds | EAS (`mobile/eas.json`), app id `com.dooey.app` |

`mobile/patches/` holds patch-package patches applied on `postinstall` (one keeps native tab icons
from being tinted as templates). If a patched package misbehaves, read the patch before blaming the
library.

**Do not add** without asking: NativeWind or Tailwind, a component kit, a second data-fetching or
state library, i18n, a system theme, a third font, react-navigation used directly instead of
expo-router, a block-editor library.

---

## Running it

```bash
pb/pocketbase.exe serve          # backend on :8090, start this first
cd mobile && npm start           # Metro, then press i, a or w
cd mobile && npm run typecheck   # tsc --noEmit
cd mobile && npm run lint
```

`mobile/src/lib/pb.ts` derives the API host from Expo's `hostUri` in dev, so phones, emulators and
the web all find PocketBase with no config. Production builds set `EXPO_PUBLIC_PB_URL`.

**`pb/pb_data` is live user data.** Never delete, reset or hand-edit it. Schema changes go through
`pb/pb_migrations/`.

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

Full gym data model: [mobile/docs/gym.md](mobile/docs/gym.md), section "Server collections".

---

## Auth and sessions

Every space sits behind a guard; `/login` is the only public route.

- `(tabs)/_layout.tsx` redirects signed-out visitors to `/login`. `onboarding.tsx` runs for new
  accounts.
- The session persists through PocketBase's `AsyncAuthStore` over AsyncStorage. **`authLoaded`
  (`mobile/src/lib/pb.ts`) must resolve before auth state means anything**: await it, do not race it.
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
| Palette, fonts, presets, backdrops, doodle pages | `mobile/src/features/style/tokens.ts` |
| `Palette` type, `alpha()`, `relight()` | `mobile/src/lib/theme.ts` |
| Live palette, type, elevation (`usePalette`, `useType`, `useElevation`) | `mobile/src/stores/theme.ts` |
| Radius and shadow strength (`useCardRadius`, `useShadow`) | `mobile/src/features/style/store.ts` |
| Durations, easings, gesture springs | `mobile/src/lib/motion.ts` |
| Shared primitives (surface, plate, sheet, stamp-edge, grain, pressable-scale, Check) | `mobile/src/components/` |

**If a value appears in two components, it belongs in a token.**

Full rules: [docs/design-system.md](docs/design-system.md). Known drift and the migration order:
[docs/design-audit.md](docs/design-audit.md). The `design-system` skill
(`.claude/skills/design-system/`) loads both and checks a diff against them, including computing
damping ratios; `/design-check` runs it.

---

## Repository layout

```
DOOEY/
├── CLAUDE.md               ← you are here
├── mobile/                 ← THE APP (Expo)
│   ├── app.json            ← Expo config (plugins, icons, typed routes)
│   ├── eas.json            ← build profiles
│   ├── patches/            ← patch-package patches, applied on postinstall
│   ├── docs/gym.md         ← gym architecture, UI and logic
│   ├── docs/gym-ux-plan.md ← the in-flight gym redesign
│   └── src/
│       ├── app/            ← expo-router routes
│       ├── components/     ← shared primitives (Dock, sheet, plate, surface, doodles)
│       ├── features/       ← tasks, workouts, boards, learning, style, auth
│       ├── lib/            ← pb, theme, dates, haptics, sounds, doodle, confirm, shell
│       └── stores/         ← auth, theme, sheet, garden (Zustand)
├── pb/                     ← PocketBase binary, pb_hooks, pb_migrations, pb_data (never touch pb_data)
├── docs/                   ← design system, deploy runbook, learning programs
├── scripts/                ← learning-program verify and push
└── src/ android/ ios/      ← legacy web app and its Capacitor shells (frozen)
```

Routes in `mobile/src/app/`: `(tabs)/` for the five spaces, `(detail)/` for `task/[id]`,
`project/[id]`, `routine/[id]`, `workout/[id]`, `board/[id]`, `preferences`, `style`, `wordmark`,
and at the root `compose`, `login`, `onboarding`.

A feature's code lives **entirely** inside `mobile/src/features/<feature>/`: `components/` for its
UI, `api.ts` for its PB queries and mutations, `types.ts`, `store.ts` when it needs one. If two
features reach for the same thing, it moves to `mobile/src/lib/` or `mobile/src/components/`.
Folders are created when a feature needs them, never pre-created empty.

---

## Legacy web app (frozen)

Root `src/` is the original Vite app: React 19, TanStack Router, Tailwind v4, shadcn/ui,
`motion/react`, wrapped by Capacitor 8 in `android/` and `ios/`, shipped as one Docker image to a
free-tier Compute Engine VM ([docs/deploy-google-cloud.md](docs/deploy-google-cloud.md), with
auto-deploy in [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

Last commit 2026-07-18. **Do not add features to it, and do not copy its patterns into `mobile/`**:
different styling system, different router, different animation library. It still owns one live
thing, materializing learning-program sessions into tasks. Ask before deleting any of it.

[docs/roadmap.md](docs/roadmap.md) and [docs/architecture.md](docs/architecture.md) predate the
migration and describe this web app. Read them as history, not as the plan.

---

## Learning programs

Programs built with the **learning-architect** skill are verified and pushed straight into
PocketBase, never hand-imported:

```bash
npm run verify-program -- <dir>
npm run push-program   -- <dir>
```

Full procedure, file formats, and the one caveat that matters (materialization still runs in the
legacy web app): [docs/learning-programs.md](docs/learning-programs.md).

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

- **One store per domain** in `mobile/src/stores/` (`auth`, `theme`, `sheet`, `garden`), except
  feature-isolated stores, which live in the feature folder (`features/workouts/store.ts`,
  `features/style/store.ts`).
- **Three kinds of state, never blurred**: server state is TanStack Query, preferences are Zustand
  plus AsyncStorage, static data is bundled (the exercise library and the program catalog).
- **Theme** is light and dark only. No system theme. Light is the default.
- **Autosave, no save buttons.** The gym feature has none anywhere; new surfaces match.

---

## What to read next

1. [mobile/docs/gym.md](mobile/docs/gym.md): the current app's deepest feature, end to end.
2. [mobile/docs/gym-ux-plan.md](mobile/docs/gym-ux-plan.md): what we are fixing right now, and why.
3. [docs/design-system.md](docs/design-system.md): the tokens, the ownership rule, and the motion rules.
