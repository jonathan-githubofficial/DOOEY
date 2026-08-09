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

## Current state (updated 2026-08-09)

**Keep this section true.** Update it before you end a session. It is the only place that records
where things actually stand, and it is what spares the next session from re-reading the repo.

- **The drawer's corner is one action, and it swaps** (`TaskComposer`). Empty, it is a filled mic:
  the fastest way to say something is out loud. The moment there is a title it becomes the send
  disc. One accent in the drawer either way, and the corner is never an empty square waiting for
  you to earn it. **The stamp still opens the drawer** — talking is a way *into* composing, not a
  replacement for it, which an earlier pass got wrong by making the stamp open the Rambler and
  demoting the form to a key inside it. `IconChip` lives in `frontend/src/components/icon-chip.tsx`.
- **Rambling takes the whole screen** (`frontend/src/features/rambler/components/RambleSheet.tsx`).
  A full-bleed wash of the user's own accent (`relight()` off `colors.zest`, so a repainted accent
  repaints this screen), an example prompt, the draft cards building as you speak, a waveform, and
  pause / file at the bottom. **The only place in DOOEY that leaves the paper behind**, and the
  reason is not drama: while you are talking there is exactly one thing to look at, and every piece
  of furniture still on screen would compete for the glance. The mic starts on open — arriving here
  *is* pressing it. `Waveform.tsx` is ambient by admission: the speech module reports transcripts,
  not amplitude, so the bars say "the mic is open" and stop dead when it closes.
- **`MenuButton`** (`frontend/src/components/menu-button.tsx`) is the platform-menu handling pulled
  out of `DotsButton`, which is now one call site of it — a menu belongs to *pressing something*,
  not to the ⋯ glyph. `SheetAction` gained `selected`, drawn as UIKit's own tick natively and by
  hand in the popover. **Today's view switcher uses it**: List / Timeline / Week was a segmented
  control eating the date shelf's width, and is now one button saying where you are.
- **Stamps is a picture of a month** (2026-08-09). A calendar grid whose squares carry the day
  itself: a photo attached to a task due that day, else the day's garden doodle, else a mark per
  tracker kept plus a bar if you trained. Picking a day opens it with its photos, the muscle figure
  for that day's session (the same `MuscleMap` the gym draws) and everything logged. The grid
  arithmetic is `features/trackers/album.ts` (`monthGrid`, pure and tested); `useMonthAttachments`
  in the tasks feature is the only query that exists to fetch pictures. **This app is looked at**:
  a table of counts would be the same information with the pleasure taken out.
- **The dock is fixed and `features/home/` is gone.** Arrangeable spaces cost a store, a persistence
  path onto `users.shell`, a page of list arithmetic, `ArrangeList`, and a race in the native tab
  bar that took two attempts to close — for a feature that only mattered when there were too many
  spaces. `SPACES` is now the bar, both bars map over it, and `resolveDock`/`DOCK_CHOICES`/`spaceOf`
  are deleted. `users.shell` is still in the schema and no longer written. The garden panel went
  with it: the day doodles surface on Stamps, where they mean something.
- **One door in, one door back** (2026-08-09, the second pass of the same day). **Today** is where
  everything is logged; **Stamps** is where you look at what you collected. They were briefly one
  page and it was wrong in both directions: a composer you had to leave your day to reach, over a
  list too short to be a record. **The rule this settled: a page either takes input or shows
  history, and if it does both, neither is any good.**
- **Ritual slots log in place** (`frontend/src/features/trackers/components/LogSheet.tsx`, mounted
  once in the root layout beside `SheetHost`). Tapping an unkept tracker slot opens the composer
  for that slot's tracker over the day you are already looking at; a ritual pointed at "any" asks
  which. The sheet also lists what that tracker already collected today, editable, because "did I
  already log lunch?" is most of why anyone opens it twice.
- **Five spaces, not six.** Planner became **Today** (and now opens on the day, not the week — a
  space called Today that greets you with a week grid is arguing with its own name). Projects is
  gone: a programme *is* its tasks, they already materialize onto the planner, and the folder stays
  reachable from any task carrying a `project` via a Key on its page. **Rituals moved out of
  Preferences** onto a `(detail)/rituals.tsx` reached from Today's shelf, so the week is edited on
  the page that draws it.
- **Trackers are managed on Account**, under "what you track" (`TrackersPanel`). Deciding to track
  your sleep belongs beside choosing your palette, not on the page you walk through to see last
  week. `useSeedTrackers` is mounted on Today, so an account that never opens Account still gets
  its first tracker.
- **What the app tracks is now data, not code** (2026-08-09, migration 033, `frontend/src/features/trackers/`).
  A **tracker** is an aspect the user created: name, stable `slug`, a `hue` from the palette, and a
  **shape** that is the only thing the client switches on — `text`, `scale`, `amount`, `duration`,
  `tick`. An **entry** is one moment of one tracker (`at`, optional `body`, optional `value`;
  minutes for a duration). Every shape may carry words, because "78, felt bloated" is worth more
  than either half. This replaced `journal_entries`, which was this table with `"food"` hardcoded
  into it, and the Journal space, which was this page with food hardcoded into it. **Before adding
  a branch for one kind of thing, check whether it wants to be a tracker instead** — that is the
  mistake this change existed to undo, and `RitualKind` and `look.ts` are where it had grown.
- **`Ritual.kind` is `"training" | "tracker"`**, was `"gym" | "journal"`. A tracker ritual's `ref`
  is a tracker id and an empty `ref` means "anything of that sort counts", matching what an empty
  ref already meant on a training ritual. `sanitizeRituals` reads the old names on the way in
  (`LEGACY_KIND`), so an arrangement made before the rename keeps its days and times. `useDayRituals`
  now joins against `entries` filtered by tracker, one code path instead of a switch.
- **Each shape gets the control it deserves** (`EntryComposer`, used by the log sheet). A scale logs
  on the tap itself — there is nothing to confirm about pressing the number 4 — and
  `amount`/`duration` open holding **last time's value** (`useLastEntry`) rather than a blank.
  Nodding at 78 beats typing 78, and that rule belongs to the whole app, not just the gym.
- **The boot chime is gone** (2026-08-09). `playDooey` played at the front door *regardless* of the
  paper-sounds switch, which made it the one sound the user did not own. Removed with its asset;
  `flip` and `scratch` remain and both sit behind the switch (default off).
- **`<Key>` gained `tint` + `selected`**, so a row of keys can say "you are here" without every page
  rolling its own tinted pill beside the plain ones. Used by the log sheet's tracker picker and the
  shape picker.
- **Branch** `feat/expo-migration`; the Rambler feature below is written but uncommitted.
- **Rambler landed (2026-07-29, first cut, not yet exercised against a live model).** Talk or type
  a ramble in the compose drawer's Mic mode and a draft of tasks and entries
  builds live; a send disc files the lot. The parse endpoint is
  `backend/pb_hooks/rambler.pb.js` (`POST /api/rambler/parse`, auth-required, stateless: whole
  transcript in, complete intended state out, which is what makes mid-sentence corrections free).
  It calls any OpenAI-compatible provider, configured by env: `RAMBLER_API_URL`,
  `RAMBLER_API_KEY`, `RAMBLER_MODEL` (unset returns 503 and the client shows its hiccup state).
  Client code is `frontend/src/features/rambler/`: `loop.ts` (single-flight, rev-gated parse
  policy) and `commit.ts` (draft to record mapping) are pure and tested; `stt.ts` wraps
  **expo-speech-recognition, a new native module, so the dev client needs a rebuild**
  (`eas build --profile development`) before the mic works on a device (web uses the browser's
  Web Speech API where present; typing works everywhere). **`stt.ts` requires that package inside
  a `try`/`catch`** (2026-08-01). It resolves its native module at *import* time, so on a dev
  client built before the module existed the import threw `Cannot find native module
  'ExpoSpeechRecognition'` and took the whole `/rambler` route with it — including the "typing
  works" fallback the screen already drew, which the throw made unreachable. A missing module is
  now just `available: false`. **An optional native module wants this treatment every time**: a
  plain import quietly makes it mandatory, and nothing fails until a device without it opens the
  route. `useCreateTask` learned an optional `checklist`. **Entries stay unparsed by design**: the
  model routes and datestamps the speaker's words, never itemizes them. Since 2026-08-09 the client
  sends the user's trackers with each parse and they are **the only vocabulary the route may route
  into** — it will not invent a slug, and an entity naming an unknown one is dropped server-side.
  Adding a tracker in the app is therefore also how you teach the rambler a word.
- **`npm run lint` currently fails on 32 pre-existing errors** (react-hooks 7 immutability/ref
  rules vs reanimated shared-value idioms in LiveBar, Dock, ArrangeList, BoardCanvas, account,
  index, DoodleEditor, pressable-scale). None are in the tracker change; they need either rule
  configuration for reanimated or targeted rewrites.
- **Shipped in `frontend/`**: auth and onboarding, Today (list/timeline/week views, timeboxing,
  ritual slots, the Rambler and the compose sheet behind it), Boards, Stamps (the album), Account,
  the Style studio (runtime palette, fonts, backdrops, doodle icons), Gym, Rituals, and learning
  programmes as tasks.
- **Today is the home page** (`frontend/src/app/(tabs)/index.tsx`). The separate Home widget
  stack was removed on 2026-07-27: it duplicated the planner's today view without adding anything.
  The month unfolds out of the date shelf rather than being a fourth view, and `WeekStrip` takes a
  `compact` prop so Week mode does not print the seven days twice.
- **A jest-expo test rig exists**: `cd frontend && npm test` runs 109 tests — the album's month
  grid and streaks, `SPACES`/`spaceFor`, the ritual schedule engine (including the legacy
  kind mapping), tracker slugs and value formatting, the rambler's loop and draft mapping, the
  muscle-figure mapping tables, tag parsing, and the compose sheet's presentation options.
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
  which is the decoration-without-a-job a metaphor is not allowed to be here. **Nothing on the card
  is outlined** (2026-08-04): no stroke on any cut, and `styles.ticket` takes the Panel's border off
  too. The edge is a tone step, eight points of lightness from the card to the page, which is what
  torn paper is; a line around a tear is a line real paper does not have. Both halves of that were
  bugs first. The Panel's border, because absolute children sit *inside* a View's border, so an edge
  painted into a bordered card drew a second outline chasing it a point in from the first: a fence
  around the hero, rings the eye had to resolve before it reached the week. Then a single stroked
  `silhouette()` path replacing those loose arcs, which was better and still one line too many.
  Removing the scallops instead is also wrong and was tried first: it leaves an ordinary rounded card.
  **Every bite is page painted on top, not a real cutout** — a disc in each bite, the very circle its
  arc came from, clipped to the inward half by the SVG's viewport. A mask would stop the colour fields
  reaching the edges (the art plate bleeding off the leading edge is the point of the counterfoil) and
  would cost the shadow on Android, which follows a view's bounds and not its paint.
  **Only the bites are painted.** Filling the whole region outside the silhouette (an `evenodd` mat)
  was the second wrong fix: the Panel's radius has already rounded the card at a corner, so covering
  the corner sliver cut nothing and instead laid a flat ungrained slab there, which read as the ticket
  being glued to a square patch of paper. There is nothing to remove at a corner, so nothing is
  painted at one.
- **`useGrainedPaper()` is what a hole through to the page is filled with** (2026-08-04,
  `frontend/src/components/grain.tsx`). **`colors.paper` is the page's base, not its appearance**: the
  noise layer over it costs about 4% of its lightness in light mode, which is ten points a channel. So
  every cut on the training ticket, filled with flat `paper`, came out *lighter* than the page it was
  meant to be a hole through to and read as a white blob stuck on the card — the third wrong fix, and
  the one that survived two rounds of looking at it before pixel-sampling a screenshot settled it
  (page `(235, 233, 228)`, bite `(238, 234, 227)` after, off by eleven before). The hook flattens
  paper-plus-noise to one colour, from the same speck opacity and user grain strength `Grain` itself
  uses, through a new `veil()` in `lib/theme.ts`. **Anything that paints a piece of one surface on top
  of another needs it**, because it cannot show the real thing through. Getting the tone right is also
  what let every rim come off the cuts: against flat `paper` a bite was four points from the card and
  needed a line to read as an edge at all, and against the page's true tone it is eight. **The tear is split between the halves rather than straddling them**, so neither
  paints outside its own box and no platform's overflow or z-order rules can break it; the halves
  round to the *full* radius, not `radius - 1`, now that there is no border to sit inside. The side
  bites drop out near the tear (`scallops(…, near)`), because the fold notch is a bite three times
  their size and does not want three little ones chewing at its mouth. History left the card for
  `(detail)/history.tsx`: how this week is going and what you have done since January are different
  questions, and the second was never a state of the first.
- **`<Key>` is the app's secondary action** (2026-08-04, `frontend/src/components/surface.tsx`). A
  small paper key: Panel stock (surface, grain, the user's rule, `useElevation()`, the user's radius
  clamped so a 34pt-tall control cannot round into a lozenge) with a tracked uppercase label. Where a
  `Plate` shouts a page's one big move, a Key murmurs a caption you can press. It exists because
  every page had been rolling its own hairline 999 pill — the gym had two, History and Browse
  programs — which was a browser chip: flat, weightless, and wearing a radius the user's slider could
  not reach. **Reach for it before hand-rolling another pill**; the gym's two are the only call sites
  so far, so the rest are still there to migrate.
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
- **Rituals tie the spaces together** (2026-07-27, generalized 2026-08-09,
  `frontend/src/features/rituals/`). A ritual is a standing commitment — a routine on chosen
  weekdays at chosen times, or a tracker once or several times a day — and its slots lay themselves
  out on all three planner views, styled per kind: a training slot wears its routine's card hue and
  emblem and its play disc starts the session from the planner; a tracker slot wears the tracker's
  own hue and opens Stamps. **Nothing records whether a slot was kept.** `useDayRituals` derives
  that by joining the schedule against the workouts and entries that already exist, so deleting a
  session un-keeps its slot. Each slot owns a *band* (to the midpoints between neighbouring times),
  which is what lets three meal slots resolve independently against one flat list of entries.
  Schedules live in `users.rituals` (migration 031) and sync exactly like `users.shell`. Edited on
  Preferences, under **Rituals** — which is the wrong home for them and the next thing to move.
- **Migrations through 033 are applied** in `backend/pb_data`. PocketBase runs pending ones on
  start, so a new file lands on the next `backend/pocketbase.exe serve`.
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

Five spaces behind the tab bar, declared in
[frontend/src/lib/spaces.ts](frontend/src/lib/spaces.ts) (`SPACES`) and rendered by both tab bars
from [frontend/src/app/(tabs)/_layout.tsx](frontend/src/app/(tabs)/_layout.tsx):

1. **Today** (`index`): the front door, the calendar, and the one place things go in. List,
   Timeline and Week views, timeboxing, the month unfolding out of the date shelf, and the day's
   ritual slots laid out above the tasks — each of them loggable where it sits.
2. **Boards**: free-form mood boards (notes, text, links, photos, stickers, doodles, sections) on
   a pannable, zoomable canvas with a freehand ink layer. See
   [frontend/docs/boards.md](frontend/docs/boards.md).
3. **Gym**: programs, routines, live logging, history.
4. **Stamps**: the album. A month at a time, each day's square carrying its photo, its doodle, or a
   mark per thing you kept; picking one opens what that day actually was. Streaks underneath. Read
   only — nothing is logged or edited here.
5. **Account**: identity, appearance, the Style studio, what you track, and your dock.

**The dock is fixed**: `SPACES` is the bar, and both tab bars map straight over it. Native builds get
the platform's own (`NativeTabs` from `expo-router/unstable-native-tabs`), with the hand-drawn page
doodles rasterized off-screen into bitmap icons when "doodle icons in dock" is on; the web build
keeps the DOOEY dock island (`frontend/src/components/Dock.tsx`). Add a space to `SPACES` and both
grow it. It used to be arrangeable — see the Current state note for what that cost.

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
`/planner` and `/`, and again renaming the Journal route to `/stamps`.

**`backend/pb_data` is live user data.** Never delete, reset or hand-edit it. Schema changes go through
`backend/pb_migrations/`.

---

## Data (PocketBase)

Collections, all owner-scoped: `users`, `tasks`, `moodboards`, `routines`, `workouts`,
`workout_programs`, `learning_programs`, `trackers`, `entries`.

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
- A **tracker** is the user's own definition of an aspect; an **entry** is one moment of one. `slug`
  is unique per owner because the rambler resolves speech by it. Deleting a tracker cascades to its
  entries, which is why `archived` exists: it is the ordinary way to stop tracking something and
  keep what you logged.
- `entries.value` is a plain number, not a JSON bag. Something needing three numbers is three
  trackers, or it is the gym.

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
│       ├── features/         ← tasks, workouts, boards, learning, trackers, rituals, rambler, style, auth
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

Routes in `frontend/src/app/`: `(tabs)/` for the five spaces, `(detail)/` for `task/[id]`,
`project/[id]`, `routine/[id]`, `workout/[id]`, `board/[id]`, `tag/[tag]`, `history`,
`preferences`, `rituals`, `style`, `wordmark`, and at the root `compose`, `login`, `onboarding`, `rambler`.

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
become tasks in the app now (`useMaterializePrograms`, mounted on Today), so push then open Today
and the sessions are on the days they belong to. The programme folder itself
(`(detail)/project/[id]`) is reachable from any of its tasks.

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
