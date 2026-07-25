# Gym — friction audit & improvement plan

A companion to [gym.md](gym.md). That doc maps what the Gym *is*; this one names where it's
**tedious or confusing** today and lays out the plan to fix it.

## North star — two loops

Everything below is judged against one purpose — *easy logging, and tracking for progressive
overload* — which is really **two loops** that have to interlock:

- **The logging loop** — open a routine, confirm or beat each set, done. As few taps as possible.
- **The overload loop** — see what you did last time, know the next target, hit it, get a small
  nod, watch the trend climb over weeks.

Progressive overload is the *point* of the tracking. An app that stores numbers but never closes
the loop back to "here's what to beat" is a logbook, not a training tool. **The first draft of
this plan served the logging loop well and under-served the overload loop** — this revision
balances the two.

Concrete bar to hold ourselves to: *logging a set that hits target = 1 tap; adjusting it = ≤3.*

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
It breaks both loops: the app knows the target and still makes you re-enter it.

### 2. Progressive overload is passive — the app never closes the loop

The ghost shows what you did last time ([workout/[id].tsx:517](mobile/src/app/(detail)/workout/[id].tsx#L517)),
and that's the whole of the "overload" story. The app never:

- proposes the **next** target (last time +1 rep, or +smallest plate),
- **acknowledges** when you beat it — no PR, no small celebration, despite the design language
  literally calling for "completions celebrate small,"
- shows an exercise's **trend** over time — history is per *session*, so you can't see "bench over
  the last 8 weeks."

Half the north star is missing. This is the biggest gap in the current plan, not just the app.

### 3. Two screens that look the same but aren't

The routine editor and the live logger both render exercise cards with thumbnails and per-exercise
controls, but one is *planning* and one is *doing*. Nothing visually signals which mode you're in —
made worse by #1, since the targets never actually connect the two.

### 4. Start → Stop is two taps per set for what's normally one

Completing a set is tap Play, then tap Square
([workout/[id].tsx:551-573](mobile/src/app/(detail)/workout/[id].tsx#L551-L573)). The muscle-memory
standard is: tap ✓ once, rest starts. Explicit start/stop timing helps *some* people, but as the
default it doubles the interaction cost of the core loop — and most people log a set *after* doing
it, not by pressing start before.

### 5. Browsing a program launches a live workout

In Explore, tapping a routine *row* immediately starts a session
([ProgramsExplorer.tsx:173-197](mobile/src/features/workouts/components/ProgramsExplorer.tsx#L173-L197)).
There's a Play icon, but the row reads like a preview. And a started-from-program routine **isn't
saved** — to keep "Push" you must "Add program" (all routines, all-or-nothing). There's no "save
this one routine."

### 6. Rest & running state vanish when you leave the session

`running` and `rest` are component-local ([workout/[id].tsx:84-87](mobile/src/app/(detail)/workout/[id].tsx#L84-L87)).
Background the app to check a text mid-rest — a completely normal thing between sets — and the
countdown and the "which set is running" highlight reset. Logged sets survive, but the *live*
state doesn't. That's friction squarely in the logging loop.

### 7. Mixed, tedious input models

Reps / sets / rest are steppers; weight is a typed field
([routine/[id].tsx:194-220](mobile/src/app/(detail)/routine/[id].tsx#L194-L220)). Four controls per
row that `flexWrap` onto two lines on a phone. Setting "5 reps" from a default of 8 is three taps
down.

### 8. Hidden affordances

History rows delete on long-press ([gym.tsx:307](mobile/src/app/(tabs)/gym.tsx#L307)); the routine
card's ⋯ *only* deletes — no rename, no duplicate
([gym.tsx:269-283](mobile/src/app/(tabs)/gym.tsx#L269-L283)). Discoverable by accident, if at all.

---

## Quick wins

Low risk, most relief per line changed. Do these first — they stand on their own and clear the way
for the structural plan.

- **Carry targets into the session.** Seed each set's reps/weight from the routine item's targets;
  let last-time ghosts override when present. ~10 lines in `useStartWorkout`. Fixes #1.
- **Explore routine tap → preview, not launch.** The row opens a routine detail with explicit
  **Start** and **Save to my routines** (single routine) actions.
- **One-tap complete** as the default set action; keep Start/Stop as an opt-in "timed set."
- **Beat-last-time tint.** When a logged set meets or beats its ghost, wash the row leaf-green;
  below, stay neutral. One conditional style — overload made visible in the moment.
- **Surface the menus.** A visible ⋯ with rename / duplicate / delete; a visible delete on history
  rows.

---

## The plan — two interlocking loops

### A. The prescription (serves the logging loop)

> **A routine — and every catalog program — is a prescription: exercises × sets × target
> reps / weight / rest. Starting a workout instantiates that prescription.**

1. **Data — no change.** `items` already holds `target_reps` / `target_weight`
   ([types.ts:6-14](mobile/src/features/workouts/types.ts#L6-L14)). We just *use* them. No migration.
2. **Start — instantiate.** `useStartWorkout` pre-fills each set from the target; last-time ghosts
   layer on top when present. The session opens with numbers to confirm, not blanks to type.
3. **Log — one tap to confirm.** Completing a set is one ✓ that confirms the prefill and fires
   rest; adjust only when reality differs. Start/Stop becomes an opt-in timed mode.
4. **Two modes of one object.** Editor and logger share a visual language — a **plan** state
   (targets, muted) and a **perform** state (live, filled) — so you always know which you're in.
5. **Explore — preview, then Start or Save-one.** The catalog's rep schemes reach the session
   intact.

### B. The overload loop (serves the tracking half)

The part the first draft was missing. Kept deliberately dumb — "simple first, smart later."

1. **Progression-aware prefill.** The prefill is last-time's numbers — so the default *is* repeat.
   A subtle **+ increment** control on the weight cell (smallest plate: 2.5 lb / 1.25 kg,
   preference-driven) makes going up one tap. Progression is the path of least resistance, not extra
   work.
2. **Beat-last-time signaling** (the quick win, formalized). Each cell shows the ghost; a set that
   meets/beats it washes leaf. The target-to-beat is always on screen.
3. **PRs + a small celebration.** Track per-exercise bests — heaviest weight, best estimated 1RM
   (Epley: `w × (1 + reps/30)`), best single-set volume. Beating one mid-session triggers a small
   on-brand celebration (a tick draw-on / color wash — never a confetti wall) and a **PR** chip in
   the session summary. This is the emotional core of lifting, and it's cheap.
4. **Per-exercise trend** *(later)*. Tap an exercise → a lightweight history: last N top sets and a
   sparkline of top weight or est-1RM. The surface where overload becomes visible across weeks.
   Powered by a `previousLookup`-style scan; no schema change.

### Robustness: keep the live session alive

**Persist `running` / `rest`** across navigation and backgrounding — lift them out of component
state (keyed by workout id, derived from timestamps so they survive a cold return). Directly serves
the logging loop; folds cleanly into the timestamp-derived clock the app already uses.

---

## Now / later (simple-first)

Respecting "ship the dumb version that works; add intelligence only after the basics earn it":

| Now | Later | Not planned |
|---|---|---|
| Carry targets; one-tap complete | Per-exercise trend + sparkline | Charts/analytics dashboard |
| Beat-last-time tint; +increment | PR history view | Auto-regulated/AI programming |
| Explore preview + save-one | Persist live timers | Warmup/drop/failure set types |
| PR detection + small celebration; surfaced menus | Plan/perform shared visual language | |

---

## Rider cleanup

Fold in while touching this code (they're current code-quality-rule violations found in the audit):

- `kindOf()` only ever returns `weight_reps`, yet the editor still branches on
  `p.kind === "duration"` ([routine/[id].tsx:102](mobile/src/app/(detail)/routine/[id].tsx#L102)) —
  dead paths. Committing to the universal set lets them go.
- Unused styles `kinds` / `kindChip` / `kindLabel` in `ExercisePicker`.

---

## Sequenced delivery

Each step is independently shippable and ends with a testable outcome.

1. ✅ **Carry targets into the session.** *Done when:* starting StrongLifts Workout A opens with
   5×5 prefilled, and a never-run custom routine shows its editor targets (not "—").
2. ✅ **One-tap complete + beat-last-time tint;** Start/Stop demoted to opt-in (a per-exercise
   stopwatch toggle). *Done when:* a target-matching set logs in one tap and washes green when it
   meets/beats the ghost.
3. ✅ **+increment on weight + PR detection & celebration.** *Done when:* the keypad bumps weight by
   a plate in one tap, and beating a per-exercise best flashes a **PR** and plays the flip.
4. ✅ **Explore preview → Start / Save-one; surfaced menu** (duplicate / delete — rename lives in the
   editor). *Done when:* tapping a program routine previews it, and you can save a single routine
   without adding the whole program.
5. ⏳ *(later)* **Persist live timers; editor lightening + shared plan/perform language.** *Done
   when:* backgrounding mid-rest returns to a still-running timer, and planning vs performing is
   visually unmistakable.
