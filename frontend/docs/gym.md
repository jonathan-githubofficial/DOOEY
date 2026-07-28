# Gym — architecture (UI & logic)

The Gym is DOOEY's workout tracker: browse proven programs, shape your own routines, run a live
session logging weight × reps per set with a rest timer, and keep a history. Modelled on Hevy,
dressed in DOOEY's "tactile objects" language.

This doc is the map. It partitions the feature into its **surfaces** (what you see), its
**feature module** (the logic), and its **server collections** (what persists), and then walks
the handful of mechanics that make it feel right (autosave, the single live session, start→stop
rest, memory ghosts, the docked keypad).

> Lives in `frontend/` only — the Gym is a native-migration feature and has no counterpart in the
> legacy web app, so it's documented here rather than in the repo-root `docs/`.

---

## The mental model — four verbs

Everything in the gym is one of four moves. The whole information architecture falls out of them:

```
  BROWSE ───────────▶ SHAPE ───────────▶ DO ───────────▶ REVIEW
  programs catalog    routine editor     live logger      finished session
  (someone else's     (your plan:        (weight×reps,     (same page,
   plan → yours)       exercises+targets)  rest timer)       read-only)
```

- **Browse** — Explore the program catalog (famous splits). Start a day now, or copy a whole
  program into your routines.
- **Shape** — Edit a routine: name it, describe it, stack exercises from the library, set
  sets / reps / weight / rest targets.
- **Do** — Start a workout from a routine (or blank). Log each set through a docked keypad; a
  Start→Stop on every set fires that exercise's rest timer.
- **Review** — A finished session opens the same page, read-only, in the history log.

---

## Surfaces (the UI layer)

Eight surfaces. Three are real routes pushed over the tabs (`(detail)/…`); two are in-place RN
`Modal`s owned by the gym screen; the rest are the tab, its keypad, and an Account drill-in.

```
(tabs)/gym.tsx  ── the hub ────────────────────────────────────────────────┐
  │  "Gym" masthead + a History key                                        │
  │  TrainingTicket: this week (counterfoil) / what to do next (stub)       │
  │  collapsible program sections of routine cards, then [Browse programs]  │
  │                                                                         │
  ├─▶ ProgramsExplorer   (Modal)      Explore → program detail → start/add  │
  ├─▶ routine/[id]       (route)      shape a routine, Start workout         │
  │     └─▶ ExercisePicker (Modal)    pick exercises from the library        │
  ├─▶ workout/[id]       (route)      the live logger  /  read-only review   │
  │     └─▶ ExercisePicker (Modal)    add exercises mid-session              │
  ├─▶ history            (route)      every week you've trained + sessions   │
  └─▶ (Account) → preferences.tsx     Gym banner: units, rest, buzz          │
```

| File | Surface | Role |
|---|---|---|
| `app/(tabs)/gym.tsx` | **Gym home** | The **training ticket** up top (see below), then **collapsible** program sections — each program (a folder of routines) heads a fold-away group of board-style routine cards + an "add routine" tile — and `Browse programs` at the end. The masthead carries the space's one action, a **History** key. Seeds a starter program on first empty open. |
| `features/workouts/components/TrainingTicket.tsx` | **The hero** | One object with two halves, drawn as a ticket: a **stamp-cut silhouette** (a scallop bitten out of every edge, a fold notch where the tear meets each side, perforation between them), tracked uppercase captions in tabular figures over every value, and art that bleeds off the paper. The **counterfoil** (paper) is the record: the week's dates, `1 of 4 days this week` against what your split asks, the seven day keys, and front/back figures standing in a full-bleed plate tinted with the hue the week came out. The **stub** below the perforation is the instruction, in the routine's own hue: `NEXT IN <PROGRAM>`, what to train, its one line of meta, and the page's only Start. Four states — a live session (captioned *IN PROGRESS*, the stamp reads *Resume*, and it deliberately carries no pause or stop), the next routine, an invitation when you own none, and a waiting note while the gym loads. |
| `app/(detail)/history.tsx` | **History** | Every week you've trained as one grid (six months, compact rows above this week's full-size one), the session count, then finished sessions as rich cards that open the read-only log. Its own page rather than a second state of the ticket: how this week is going and what you've done since January are different questions. |
| `features/workouts/components/ProgramsExplorer.tsx` | **Explore** | Program catalog → program detail. Start a routine (→ logger) or add the whole program (→ real routines). |
| `app/(detail)/routine/[id].tsx` | **Routine editor** | Name + description, ordered exercise list with sets/reps/weight/rest steppers, `Start workout`. Debounced autosave, no save button. |
| `features/workouts/components/ExercisePicker.tsx` | **Library** | Browse **by muscle group** — group cards → drill into a group's exercises (moving polaroid tiles); search cuts across all 1,500. Multi-select to add, ⓘ for the how-to (motion GIF + a male/female **muscle map** shading the worked muscle). Reused read-only as pure reference. |
| `app/(detail)/workout/[id].tsx` | **Live logger / review** | Set grids, docked keypad, per-set Start→Stop → rest timer, stats strip, notes. The same page renders finished sessions read-only. |
| `features/workouts/components/KeyPad.tsx` | **Keypad** | Docked number pad — presentational; the logger owns the draft. Keeps the OS keyboard out of the logging loop. |
| `app/(detail)/preferences.tsx` | **Preferences** | Account drill-in. The Gym banner holds units, default rest, auto-start rest, buzz — settings that used to clutter the gym itself. |

### Why routes vs. modals

- **Routes** (`routine/[id]`, `workout/[id]`) are the places you *live in* — deep-linkable,
  back-stackable, pushed over the tab bar by the `(detail)` stack (which carries the same auth
  guard as the tabs).
- **Modals** (`ProgramsExplorer`, `ExercisePicker`) are *pickers* — transient overlays you open,
  act in, and dismiss without leaving the surface underneath. They're RN `Modal`s (pageSheet on
  iOS, fullScreen on Android), not routes, so they never enter the history stack.

### The tactile skin (shared primitives)

The gym doesn't invent chrome — it composes the app's tactile primitives so it matches every
other space:

- `Panel` (padding 20, soft two-layer shadow) is the card everywhere; `Grain` lays paper texture
  on every screen and tile; `Eyebrow` for the tracked-caps section labels; `Masthead` +
  `PageDoodle` for the space header.
- `PressableScale` gives every tap its spring-loaded depress; `Plate` is the cast-metal primary
  button (Start / Add).
- **The routine card**: the name, the exercise count on the line under it as a numeral in the
  routine's own accent, and below both the anatomy figures centred on a floor of their own. The
  figures are the card's face, which is why there is no doodle behind them and no focus tag under
  the count: a shaded chest says "push" faster than the word. Front and back render at the same
  size and always in that order, so the same view sits in the same place on every card and a wall
  of them can be compared at a glance. That equality is also why the count sits up by the name —
  two figures this size sharing the bottom row with it would have to shrink by a third to fit a
  column this narrow. Figure size carries the wall's rhythm instead (`twinScale()`): a
  nine-exercise day literally looms larger on the board than a three-move finisher, which is a
  better thing to vary than headroom. Two things to know before nudging any of it: the artwork
  sits in a viewBox with ~7% dead margin over the head and under the feet, so box offsets are not
  visual offsets (`TWIN_HEAD` / `TWIN_FOOT` crop it, and the dead margin left on the sides is what
  holds the pair apart), and `routineHeight()` has to keep matching what the card actually renders
  or the masonry packs its columns wrong.
- **Motion**: `FadeInDown` staggers the routine cards in; `LinearTransition` (a stiff settle
  spring) reflows set/exercise lists on add/remove/reorder; `SlideInDown` brings the keypad, the
  rest bar and the batch-add bar up from the bottom edge. Everything settles, nothing snaps.
- **Destructive actions** go through `confirmDestructive` (web-safe `window.confirm`, native
  `Alert.alert`).

---

## The feature module (the logic layer)

All gym logic lives in `features/workouts/`, self-contained per the feature-isolation rule.

```
features/workouts/
├── types.ts        Routine, RoutineItem, Workout, WorkoutEntry, WorkoutSet + pure helpers
│                     (workoutVolume, workoutSetsDone, formatElapsed)
├── api.ts          TanStack Query hooks + the memory derivations (previousLookup, restLookup)
├── store.ts        useWorkoutPrefs — Zustand + AsyncStorage (unit, rest, toggles, seed guard)
├── clock.ts        useNow — a ticking Date.now() clocks derive from (background-safe)
├── library.ts      the exercise library: LIBRARY, exerciseGif, groupOf, searchLibrary, kindOf
├── programs.ts     the program catalog: POOL of libIds → 8 famous splits (static)
├── starters.ts     STARTER_ROUTINES — the PPL split, seeded on first open
├── exercises.json  ~1.2MB slice of ExerciseDB v1 (built by scripts/build-exercise-library.mjs)
└── components/     ExercisePicker · KeyPad · ProgramsExplorer
```

### State boundary (matches the app-wide convention)

| Kind | Owner | What |
|---|---|---|
| **Server state** | TanStack Query (`api.ts`) | `routines`, `workouts` — fetched, mutated, invalidated. Query keys in `gymKeys`. |
| **Client state** | Zustand + AsyncStorage (`store.ts`) | `useWorkoutPrefs`: `unit`, `restSeconds`, `autoStartRest`, `restDoneBuzz`, `seededRoutines`. |
| **Ephemeral UI** | component `useState` | The live session's `running` set, `rest` countdown, keypad `focus`/`editStr`, editor drafts. |
| **Static data** | bundled modules | `library.ts` / `programs.ts` / `starters.ts` — imports, not state. |

Server writes follow **local-leads-PB-follows**: the editor and logger update local state
immediately and fire the mutation behind it, so a tap is never lost to latency and a crash
mid-session costs at most the last keystroke.

### Query hooks (`api.ts`)

| Hook | Does |
|---|---|
| `useRoutines()` | All routines, `sort: position,created`. |
| `useWorkouts()` | Last 60 sessions, `sort: -started_at`. The live one (empty `ended_at`) rides on top. |
| `useWorkout(id)` | One session. |
| `useSaveRoutine()` | Create or update (name / items / description). |
| `useDeleteRoutine()` | Delete a routine (history untouched). |
| `useStartWorkout()` | Open a session from a `RoutineTemplate` (or blank) — each item becomes an entry with N empty sets. |
| `useUpdateWorkout(id)` | Patch `title` / `entries` / `ended_at`. |
| `useAddRoutines()` | Batch-create — seeds starters and copies a whole program's routines. |
| `useDeleteWorkout()` | Delete a session. |
| `previousLookup` / `restLookup` | **Not hooks** — pure derivations over finished sessions (see Memory below). |

---

## The mechanics that matter

### 1. One live session, derived not flagged

There's no "is a workout running" boolean. The live session **is** `workouts.find(w => !w.ended_at)`.
Every entry point (`gym.tsx`, `routine/[id]`) reads that: if a session is live, "Start workout"
becomes "Resume" and jumps into it instead of opening a second one. Finishing stamps `ended_at`,
and the same record instantly becomes a history row.

### 2. Autosave, no save buttons

- **Routine editor** — name / description / items feed a 600 ms debounce (`dirty` ref) that fires
  `useSaveRoutine`. `null` local state means "not yet edited"; effective values fall back to the
  fetched record (`effName`, `effItems`, …).
- **Live logger** — no debounce; `commit(next)` sets local state *and* mutates on every keystroke,
  set toggle, and note. Losing a tap to a crash is worse than a few extra writes at one-user scale.

### 3. Start → Stop drives rest

Each set has a Play button. The flow (`workout/[id]`):

```
tap Start  → running = "ei:si", row tints zest
tap Stop   → set marked done (empty fields adopt last-time's ghost), row tints leaf,
             if autoStartRest → rest = { until: now + rest*1000, total, ei }
```

The rest bar (`SlideInDown`) shows the countdown; `±15s` adjusts it **and remembers** the new
rest on that exercise (so next time it's pre-set); `skip` clears it. When it hits zero, a haptic
fires once (`restDoneBuzz`), guarded by a `restRung` ref so it can't repeat.

### 4. Clocks derive from timestamps (background-safe)

`useNow()` (`clock.ts`) is just a ticking `Date.now()`. Both the session duration and the rest
countdown are computed as `target - now`, never decremented counters — so backgrounding the app
or a dropped frame can't drift them. `resting = rest !== null && now < rest.until`. The logger
ticks fast while live (500 ms) and idles (60 s) when reviewing.

### 5. Memory — logging is two taps, not typing

Two pure scans over your *other* finished sessions (newest-first) power the "you don't retype what
you did last time" feel:

- `previousLookup(workouts)` → `Map<exerciseName, WorkoutSet[]>`: the completed sets from the last
  time you did each exercise. These render as **dim ghost placeholders** in the cells and the
  `prev` column, and Stop adopts them when you leave a field blank.
- `restLookup(workouts)` → `Map<exerciseName, seconds>`: the rest you last used, so a
  re-added exercise starts with your real rest, not the default.

Keyed by **exercise name** (not `libId`), so custom exercises get memory too. Client-side scan is
nothing at one user's scale (noted in the code).

### 6. The docked keypad

Tapping a weight/reps cell opens `KeyPad` (docked, not the OS keyboard) — so the grid never
thrashes as a keyboard shoves it around. The logger owns the `editStr` draft and `focus`
(`{ei, si, field}`); the pad is pure presentation. `Next` hops weight → reps → done; every digit
commits through `patchSet`, so the value is saved as you type.

### 7. Finish semantics

`finish()` strips undone sets and drops now-empty entries, stamps `ended_at`, plays the paper
flip. If **nothing** was logged it offers to discard the session instead of saving an empty shell.

### 8. First-open seeding

An empty, never-seeded gym plants the PPL starter *program* (`STARTER_PROGRAM` → `useAddProgram`)
once, guarded by the persisted `seededRoutines` flag — so the space is alive on arrival, but a
deliberately-cleared gym never regrows.

### 9. Programs group routines

Every routine belongs to a `workout_program` (a named folder you own). The home page groups
routines by program into sections. `New` creates an empty program (prompt sheet → `useSaveProgram`);
each program section has an "add routine" tile (`useSaveRoutine` with the program id); a program's
⋯ renames or deletes it (delete cascades its routines server-side). Explore's **add program** builds
a real program + its routines (`useAddProgram`); **save one routine** drops it into a catch-all
"My Routines" program (`useSaveLooseRoutine`).

---

## Static data — library & programs

### Exercise library (`library.ts` + `exercises.json`)

- Source: the open-source **ExerciseDB v1** fork (`bootstrapping-lab/exercisedb-api`, AGPL) —
  1,500 exercises, each with an animated 3D-model demo GIF (working muscle lit red) and step
  instructions.
- `exercises.json` (~1.2 MB) is a slimmed slice:
  `{ id, name, targets, secondary, parts, equip, steps }`. **Built by
  `scripts/build-exercise-library.mjs`**, pinned to the same SHA as the GIFs — run it, don't hand-edit.
- `targets` is what the movement is *for* (upstream gives exactly **one** per exercise);
  `secondary` is everything else it works. An earlier hand-built copy of this file **dropped
  `secondary`**, which is why the figure showed a bench press as chest and nothing else until
  2026-07-27.
- Demos come in **two rungs**, and `exerciseGif(ex, res)` picks between them: **360px** by default,
  **180px** for the 40–60px list thumbnails where 360 is 3× the bytes for no visible gain. Both
  hosts are **pinned to a commit SHA** so the URLs can't drift, and both are served from
  `raw.githubusercontent.com` — demos need network, they aren't bundled.
- The 360 rung is the same artwork at 2×, but the mirror carrying it keys files by ExerciseDB's
  *other* id scheme (a 4-digit number), so **`media360.json` maps our 1,500 ids → those keys**.
  It's generated from `exercises.json`; regenerate it if the library ever changes, since a missing
  key silently falls back to 180. 360 is the **best free rung that exists** for this art — above it
  the art is only sold, and the vendor's own public previews are themselves 180px.
- 1,324 distinct animations cover the 1,500 rows: 176 names are modifier variants ("cable decline
  fly" / "rough cable decline fly") that **already shared one animation at 180px**, upstream.
- `MUSCLE_GROUPS` are the browse buckets — the dataset's real target muscles (Chest, Shoulders,
  Biceps, … Cardio) with friendly labels; `searchLibrary(query, muscle)` filters by
  `targets.includes(muscle)` (or, for `"all"`, matches name / muscle / equipment on the query).
- **Anatomy (`anatomy.ts`) is the single source of truth for muscles**, and every figure
  (`MuscleMap`, `MuscleTwin`, the week body) renders through `WeekBody`, so they cannot disagree.
  - `canonicalMuscle()` folds both vocabularies into one: upstream writes "shoulders", "deltoids"
    and "rear deltoids" for the same muscle. Joints and grip ("wrists", "ankle stabilizers")
    deliberately resolve to nothing.
  - `TARGET_SLUG` says *which part of the figure* a muscle is, and `SLUGS_ON` says which views
    draw that part — **read off the package's own assets, never asserted by hand**. Stating a
    single side per muscle is what previously stopped shoulders, forearms, calves, triceps, traps
    and adductors from lighting on half the body. `anatomy.test.ts` diffs `SLUGS_ON` against
    `dist/assets/body{Front,Back}.js`, so a version bump that moves a part fails a test.
  - The figure is coarser than the dataset, so several muscles share a slug (lats/rhomboids/upper
    back → `upper-back`, abductors → `gluteal`). That fold is the honest limit of the artwork.
  - **Primary shades solid, secondary at `SECONDARY_STRENGTH`.** Where two muscles land on one
    slug the stronger claim wins, so a lat-focused pull day isn't washed out by its rhomboids.
  - `focusOf()` counts **primary only** toward a card's label and hue: a chest day that involves
    the shoulders is still a chest day, and a card that changed colour for what it brushes would
    be telling you the wrong thing. Both lists feed the figures.
  - Gender comes from `useWorkoutPrefs`.
- `kindOf()` returns **`"weight_reps"` universally** — every set is weight × reps; bodyweight
  moves just leave weight at 0. (See rough edges.)

### Program catalog (`programs.ts`)

Eight famous splits — PPL, Upper/Lower, Full Body, Bro, Arnold, PHUL, StrongLifts 5×5, Starting
Strength — each a set of named routines built from a `POOL` of verified library IDs (so every
movement has its demo). Fully static/bundled — **not** the same as a `workout_program` (the DB
folder you own). Explore reads the catalog three ways: **preview a routine**, **start it now**
(→ workout), or **add the whole program** (→ a real `workout_program` + its `routines`).

---

## Server collections (the data layer)

Three collections: `workouts` + `routines` (migration `022_workouts.js`; 023–025 evolved the
grouping) and `workout_programs` (`026_workout_programs.js`). Routines and workouts follow DOOEY's
**JSON-blob-not-join-tables** pattern — the same shape as `tasks` and `boards`: a routine or session
loads and saves as one unit, one realtime event covers the whole thing, and nothing queries
individual sets across records.

### `workout_programs` — the folders

| Field | Type | Notes |
|---|---|---|
| `owner` | relation → users | required |
| `name` | text (≤80) | required — the section heading |
| `description` | text (≤160) | optional line under the name |
| `position` | number | sort order |
| `created` / `updated` | autodate | |

### `routines` — reusable templates

| Field | Type | Notes |
|---|---|---|
| `owner` | relation → users | required |
| `program` | relation → workout_programs | the folder it lives in; `cascadeDelete: true` (deleting a program deletes its routines) |
| `name` | text (≤80) | required |
| `position` | number | sort order |
| `description` | text (≤160) | the line on the card |
| `items` | json | `RoutineItem[]` — `{ name, kind, sets, target_reps, target_weight, rest?, libId? }` |
| `created` / `updated` | autodate | |

### `workouts` — logged sessions

| Field | Type | Notes |
|---|---|---|
| `owner` | relation → users | required |
| `title` | text (≤80) | required |
| `routine` | relation → routines | nullable; `cascadeDelete: false` (deleting a routine keeps its sessions) |
| `started_at` | date | required — the session clock derives from it |
| `ended_at` | date | **empty string = live**; stamped on finish |
| `entries` | json | `WorkoutEntry[]` — `{ name, kind, sets: [{weight, reps, done}], rest?, notes?, libId? }` |
| `created` / `updated` | autodate | |

**Grouping history:** 023 added a `group` text field on routines, 025 dropped it, then 026 brought
grouping back properly as the `workout_programs` collection + a `program` relation — a first-class,
nameable folder (can be empty, renamed, deleted) instead of a loose label. 026 also backfills any
pre-existing routines into a per-owner "My Routines" program so nothing is orphaned. 024 added
`description`.

### Data isolation

Every rule on all three collections is owner-scoped
(`@request.auth.id != '' && owner = @request.auth.id` on list/view/create/update/delete), same as
the rest of DOOEY — personal now, SaaS-ready without a rewrite. The client trusts what PB returns.

---

## Rough edges worth a look

Honest notes for when we next give the gym love — none are broken, but each is a loose thread:

1. **`ExerciseKind` is effectively single-valued.** The type still declares `reps` and `duration`,
   but `kindOf()` only ever returns `weight_reps` and the picker never yields the others. The dead
   code branches are gone; the unused type arms could follow if we're sure we'll never surface
   duration/reps kinds.
2. **`running` / `rest` are logger-local.** Navigate away from a live session and the
   Start-running highlight and rest countdown reset (logged sets persist fine). Fine for now;
   would need lifting to survive backgrounding-to-home mid-set. (Plan step 5 — deferred.)
3. **Eager persistence.** `New` creates an empty program immediately, and a program's "add routine"
   creates an empty routine, then navigates — backing out leaves the empty record behind.
4. **History caps at 60** sessions (`useWorkouts`) and memory/PR scans run over all of them
   client-side — both fine at one-user scale, both worth revisiting before multi-user.

---

## At a glance

- **Browse → Shape → Do → Review** is the whole IA.
- **Routes** are places you live in; **modals** are pickers.
- **Server state** = TanStack Query (`workout_programs`, `routines`, `workouts`); **prefs** =
  Zustand+AsyncStorage; **static** = the bundled library + program catalog.
- The **live session is derived** (`!ended_at`), not flagged; **clocks derive from timestamps**;
  **memory** makes logging one tap and shows the number to beat.
- **Programs group routines** (a real collection); home is programs-only.
- Three owner-scoped collections, JSON blobs for routine/workout bodies, no join tables.
