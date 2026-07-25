# Gym — architecture (UI & logic)

The Gym is DOOEY's workout tracker: browse proven programs, shape your own routines, run a live
session logging weight × reps per set with a rest timer, and keep a history. Modelled on Hevy,
dressed in DOOEY's "tactile objects" language.

This doc is the map. It partitions the feature into its **surfaces** (what you see), its
**feature module** (the logic), and its **server collections** (what persists), and then walks
the handful of mechanics that make it feel right (autosave, the single live session, start→stop
rest, memory ghosts, the docked keypad).

> Lives in `mobile/` only — the Gym is a native-migration feature and has no counterpart in the
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

Seven surfaces. Two are real routes pushed over the tabs (`(detail)/…`); two are in-place RN
`Modal`s owned by the gym screen; the rest are the tab and an Account drill-in.

```
(tabs)/gym.tsx  ── the hub ────────────────────────────────────────────────┐
  │  Masthead · LiveBanner (if a session is running) · "my routines" board  │
  │  · history log · [Explore] [New] tools                                  │
  │                                                                         │
  ├─▶ ProgramsExplorer   (Modal)      Explore → program detail → start/add  │
  ├─▶ routine/[id]       (route)      shape a routine, Start workout         │
  │     └─▶ ExercisePicker (Modal)    pick exercises from the library        │
  ├─▶ workout/[id]       (route)      the live logger  /  read-only review   │
  │     └─▶ ExercisePicker (Modal)    add exercises mid-session              │
  └─▶ (Account) → preferences.tsx     Gym banner: units, rest, buzz          │
```

| File | Surface | Role |
|---|---|---|
| `app/(tabs)/gym.tsx` | **Gym home** | Hub. Routines as board-style cards, the running session up top, finished-session log below, `Explore`/`New` tools. Seeds starter routines on first empty open. |
| `features/workouts/components/ProgramsExplorer.tsx` | **Explore** | Program catalog → program detail. Start a routine (→ logger) or add the whole program (→ real routines). |
| `app/(detail)/routine/[id].tsx` | **Routine editor** | Name + description, ordered exercise list with sets/reps/weight/rest steppers, `Start workout`. Debounced autosave, no save button. |
| `features/workouts/components/ExercisePicker.tsx` | **Library** | 1,500 exercises as moving polaroid tiles; multi-select to add, ⓘ for the how-to. Reused read-only as pure reference. |
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
- **Board-style cards**: a routine card and a program card both wear a strip of exercise demo
  GIFs with a `+N` overflow chip — the same move as the mood-board tiles, so routines read as
  "objects" not rows.
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
├── exercises.json  ~948KB slice of ExerciseDB v1 (id, name, targets, parts, equip, steps)
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

An empty, never-seeded gym plants the PPL starter split (`STARTER_ROUTINES`) once, guarded by the
persisted `seededRoutines` flag — so the space is alive on arrival, but a deliberately-cleared gym
never regrows.

---

## Static data — library & programs

### Exercise library (`library.ts` + `exercises.json`)

- Source: the open-source **ExerciseDB v1** fork (`bootstrapping-lab/exercisedb-api`, AGPL) —
  1,500 exercises, each with an animated 3D-model demo GIF (working muscle lit red) and step
  instructions.
- `exercises.json` (~948 KB) is a slimmed slice: `{ id, name, targets, parts, equip, steps }`.
- GIFs are **pinned to a commit SHA** (`GIF_HOST`) so the URLs can't drift; served from
  `raw.githubusercontent.com`, so demos need network (they aren't bundled).
- `groupOf()` buckets each exercise into push / pull / legs / core / cardio for the picker's
  filter chips; `searchLibrary(query, group)` matches name, target muscle, or equipment.
- `kindOf()` returns **`"weight_reps"` universally** — every set is weight × reps; bodyweight
  moves just leave weight at 0. (See rough edges.)

### Program catalog (`programs.ts`)

Eight famous splits — PPL, Upper/Lower, Full Body, Bro, Arnold, PHUL, StrongLifts 5×5, Starting
Strength — each a set of named routines built from a `POOL` of verified library IDs (so every
movement has its demo). Fully static/bundled. Explore reads it three ways: **start a routine now**
(→ blank-titled workout), or **add the whole program** (→ real `routines` records via
`useAddRoutines`).

---

## Server collections (the data layer)

Two collections, added in migration `022_workouts.js` (023–025 evolved the grouping). Both follow
DOOEY's **JSON-blob-not-join-tables** pattern — the same shape as `tasks` and `boards`: a routine
or session loads and saves as one unit, one realtime event covers the whole thing, and nothing
queries individual sets across records.

### `routines` — reusable templates

| Field | Type | Notes |
|---|---|---|
| `owner` | relation → users | required |
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

**Grouping history:** 023 added a `group` text field on routines (Hevy-style folders), 025 dropped
it — grouping now lives in the read-only program catalog, not on the routine. 024 added
`description`.

### Data isolation

Every rule on both collections is owner-scoped
(`@request.auth.id != '' && owner = @request.auth.id` on list/view/create/update/delete), same as
the rest of DOOEY — personal now, SaaS-ready without a rewrite. The client trusts what PB returns.

---

## Rough edges worth a look

Honest notes for when we next give the gym love — none are broken, but each is a loose thread:

1. **`ExerciseKind` is effectively single-valued.** The type still declares `reps` and `duration`,
   and code branches on them (e.g. the editor's `p.kind === "duration" ? 30 : 8`), but `kindOf()`
   only ever returns `weight_reps` and the picker never yields the others — so those branches are
   dead paths. Either commit to weight-only and delete the type's other arms, or actually surface
   duration/reps kinds. (Touches the "no dead code" rule.)
2. **Dead styles in `ExercisePicker`** — `kinds` / `kindChip` / `kindLabel` are defined but unused.
   Delete.
3. **`running` / `rest` are logger-local.** Navigate away from a live session and the
   Start-running highlight and rest countdown reset (logged sets persist fine). Fine for now;
   would need lifting to survive backgrounding-to-home mid-set.
4. **"New routine" persists eagerly.** `New` creates the record *then* navigates, so backing out of
   an untouched "New routine" leaves an empty routine behind.
5. **History caps at 60** sessions (`useWorkouts`) and memory scans all of them client-side — both
   fine at one-user scale, both worth revisiting before multi-user.

---

## At a glance

- **Browse → Shape → Do → Review** is the whole IA.
- **Routes** are places you live in; **modals** are pickers.
- **Server state** = TanStack Query (`routines`, `workouts`); **prefs** = Zustand+AsyncStorage;
  **static** = the bundled library + program catalog.
- The **live session is derived** (`!ended_at`), not flagged; **clocks derive from timestamps**;
  **memory** makes logging two taps.
- Two owner-scoped collections, JSON blobs, no join tables.
