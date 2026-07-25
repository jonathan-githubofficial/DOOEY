# Gym — friction audit & improvement plan

A companion to [gym.md](gym.md). That doc maps what the Gym *is*; this one names where it's
**tedious or confusing** today and lays out the plan to fix it.

## North star

Everything below is judged against one purpose:

> **Easy logging, and tracking for progressive overload.**

Open a routine, log your sets in as few taps as possible, and always see what you did last time
so you know what to beat. Anything that adds taps, hides state, or makes you re-enter what the app
already knows is friction — even if it looks tidy.

---

## Where it's tedious or confusing (ranked by pain)

### 1. You fill in targets that get thrown away — *the root problem*

In the routine editor you set sets / reps / weight / rest per exercise
([routine/[id].tsx:194-220](mobile/src/app/(detail)/routine/[id].tsx#L194-L220)). But
`useStartWorkout` carries only the **set count** and **rest** — it builds every set from
`emptySet()` (`{weight:0, reps:0}`) and **ignores `target_reps` / `target_weight`**
([api.ts:113-119](mobile/src/features/workouts/api.ts#L113-L119)). Session numbers come *only* from
last-time history (`previousLookup`). The consequences:

- A routine you've never run shows "—" in every cell — you type everything from scratch.
- The program catalog authored real rep schemes (StrongLifts 5×5, bench 4×6 —
  [programs.ts:301-311](mobile/src/features/workouts/programs.ts#L301-L311)) and **all of it is
  discarded on start.** The catalog is reduced to a list of exercise names.
- Every stepper tap in the editor is busywork with no payoff.

This single gap makes the editor tedious *and* the catalog pointless *and* first-time logging slow.
It directly violates the north star: the app knows the target, and still makes you re-enter it.

### 2. Two screens that look the same but aren't

The routine editor and the live logger both render exercise cards with thumbnails and per-exercise
controls, but one is *planning* and one is *doing*. Nothing visually signals which mode you're in.
You have to remember that one sets targets and the other logs reality — made worse by #1, since the
targets never actually connect the two.

### 3. Start → Stop is two taps per set for what's normally one

Completing a set is tap Play, then tap Square
([workout/[id].tsx:551-573](mobile/src/app/(detail)/workout/[id].tsx#L551-L573)). The muscle-memory
standard is: type, tap ✓ once, rest starts. Explicit start/stop timing is useful for *some* people,
but as the default it doubles the interaction cost of the core loop — and most people log a set
*after* doing it, not by pressing start before.

### 4. Browsing a program launches a live workout

In Explore, tapping a routine *row* immediately starts a session
([ProgramsExplorer.tsx:173-197](mobile/src/features/workouts/components/ProgramsExplorer.tsx#L173-L197)).
There's a Play icon, but the row reads like a preview. And a started-from-program routine **isn't
saved** — to keep "Push" you must "Add program" (all routines, all-or-nothing). There's no "save
this one routine."

### 5. Mixed, tedious input models

Reps / sets / rest are steppers; weight is a typed field
([routine/[id].tsx:194-220](mobile/src/app/(detail)/routine/[id].tsx#L194-L220)). Four controls per
row that `flexWrap` onto two lines on a phone. Setting "5 reps" from a default of 8 is three taps
down.

### 6. Hidden affordances

History rows delete on long-press ([gym.tsx:307](mobile/src/app/(tabs)/gym.tsx#L307)); the routine
card's ⋯ *only* deletes — no rename, no duplicate
([gym.tsx:269-283](mobile/src/app/(tabs)/gym.tsx#L269-L283)). Discoverable by accident, if at all.

---

## Quick wins

Low risk, most relief per line changed. Do these first — they stand on their own and clear the way
for the structural plan.

- **Carry targets into the session.** Seed each set's reps/weight from the routine item's targets;
  let last-time ghosts override when present. ~10 lines in `useStartWorkout`. Fixes #1 — makes the
  catalog and the editor mean something, and makes first-time logging fast.
- **Explore routine tap → preview, not launch.** The row opens a routine detail with explicit
  **Start** and **Save to my routines** (single routine) actions.
- **One-tap complete** as the default set action; keep Start/Stop as an opt-in "timed set" for
  exercises where you actually want to time the work.
- **Surface the menus.** A visible ⋯ with rename / duplicate / delete; a visible delete on history
  rows.

---

## The plan — "a routine is a prescription"

The restructure that removes the root friction instead of patching around it.

> **A routine — and every catalog program — is a prescription: exercises × sets × target
> reps / weight / rest. Starting a workout instantiates that prescription.**

This is what makes progressive overload work: the routine says what to aim for, history says what
you did last time, and logging is confirming or beating the number — never typing from nothing.

### 1. Data — no change

`items` already holds `target_reps` / `target_weight`
([types.ts:6-14](mobile/src/features/workouts/types.ts#L6-L14)). We just *use* them. No migration.

### 2. Start — instantiate the prescription

`useStartWorkout` builds each set pre-filled from the target; last-time ghosts layer on top when
you've done the exercise before. The session opens with real numbers to confirm, not blanks to
type. (This is the "carry targets" quick win, formalized as the model.)

### 3. Logging — one tap to confirm, ghosts to beat

Completing a set is one tap (✓) that confirms the prefilled numbers and fires rest. You adjust only
when reality differs. Every cell shows last-time's number as the ghost, so the target-to-beat is
always visible — the progressive-overload loop, made glanceable. Start/Stop becomes an opt-in timed
mode, not the default.

### 4. Two modes of one object

Editor and logger share a visual language: a **plan** state (targets, muted) and a **perform**
state (live, filled). The same exercise card, two moods — so you always know whether you're
prescribing or doing, and the two finally connect through the carried targets.

### 5. Explore — preview, then Start or Save

Tapping a program routine opens a preview. From there: **Start** it now, or **Save this routine**
to My routines (one routine, not the whole program). The catalog's rep schemes reach the session
intact.

### Cost

| Change | Effort |
|---|---|
| Start-seeding from targets | small |
| One-tap complete (+ opt-in timed mode) | small |
| Explore preview → Start / Save-one | medium |
| Editor lightening + shared plan/perform language | medium |
| Migration | none |

---

## Sequenced delivery

1. **Carry targets into the session** (quick win + plan step 2) — the keystone; everything else
   assumes it.
2. **One-tap complete**, Start/Stop demoted to opt-in.
3. **Explore preview** with Start / Save-one, plus surfaced menus (rename / duplicate / delete).
4. **Editor lightening** and the shared plan/perform visual language.
