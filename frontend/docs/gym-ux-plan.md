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
([routine/[id].tsx:194-220](frontend/src/app/(detail)/routine/[id].tsx#L194-L220)). But
`useStartWorkout` carries only the **set count** and **rest** — it builds every set from
`emptySet()` (`{weight:0, reps:0}`) and **ignores `target_reps` / `target_weight`**
([api.ts:113-119](frontend/src/features/workouts/api.ts#L113-L119)). Session numbers come *only* from
last-time history (`previousLookup`). The consequences:

- A routine you've never run shows "—" in every cell — you type everything from scratch.
- The program catalog authored real rep schemes (StrongLifts 5×5, bench 4×6 —
  [programs.ts:301-311](frontend/src/features/workouts/programs.ts#L301-L311)) and **all of it is
  discarded on start.** The catalog is reduced to a list of exercise names.
- Every stepper tap in the editor is busywork with no payoff.

This single gap makes the editor tedious *and* the catalog pointless *and* first-time logging slow.
It breaks both loops: the app knows the target and still makes you re-enter it.

### 2. Progressive overload is passive — the app never closes the loop

The ghost shows what you did last time ([workout/[id].tsx:517](frontend/src/app/(detail)/workout/[id].tsx#L517)),
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
([workout/[id].tsx:551-573](frontend/src/app/(detail)/workout/[id].tsx#L551-L573)). The muscle-memory
standard is: tap ✓ once, rest starts. Explicit start/stop timing helps *some* people, but as the
default it doubles the interaction cost of the core loop — and most people log a set *after* doing
it, not by pressing start before.

### 5. Browsing a program launches a live workout

In Explore, tapping a routine *row* immediately starts a session
([ProgramsExplorer.tsx:173-197](frontend/src/features/workouts/components/ProgramsExplorer.tsx#L173-L197)).
There's a Play icon, but the row reads like a preview. And a started-from-program routine **isn't
saved** — to keep "Push" you must "Add program" (all routines, all-or-nothing). There's no "save
this one routine."

### 6. Rest & running state vanish when you leave the session

`running` and `rest` are component-local ([workout/[id].tsx:84-87](frontend/src/app/(detail)/workout/[id].tsx#L84-L87)).
Background the app to check a text mid-rest — a completely normal thing between sets — and the
countdown and the "which set is running" highlight reset. Logged sets survive, but the *live*
state doesn't. That's friction squarely in the logging loop.

### 7. Mixed, tedious input models

Reps / sets / rest are steppers; weight is a typed field
([routine/[id].tsx:194-220](frontend/src/app/(detail)/routine/[id].tsx#L194-L220)). Four controls per
row that `flexWrap` onto two lines on a phone. Setting "5 reps" from a default of 8 is three taps
down.

### 8. Hidden affordances

History rows delete on long-press ([gym.tsx:307](frontend/src/app/(tabs)/gym.tsx#L307)); the routine
card's ⋯ *only* deletes — no rename, no duplicate
([gym.tsx:269-283](frontend/src/app/(tabs)/gym.tsx#L269-L283)). Discoverable by accident, if at all.

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
   ([types.ts:6-14](frontend/src/features/workouts/types.ts#L6-L14)). We just *use* them. No migration.
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
  `p.kind === "duration"` ([routine/[id].tsx:102](frontend/src/app/(detail)/routine/[id].tsx#L102)) —
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

---

## The training ticket (specced and built, 2026-07-28)

The page's top two cards became **one object with two sections, drawn as a
ticket** — the top is what you have done, the stub under the perforation is what
to do next. They were `WeekPanel` and `UpNextCard`, two Panels stacked with 22pt
between them, and nothing said they were a pair. They are: one is the record,
the other is the instruction, and a ticket is precisely the shape of "one thing,
whose bottom half you tear off and use". Both are now retired into
`components/TrainingTicket.tsx`.

Why the metaphor earns its keep, by the house rule that a metaphor must clarify
what a thing *is* or *does*: the perforation carries the meaning. It says the two
halves belong to one object, and it says which half is actionable. Neither a
divider nor two cards can say that.

### Shape

```
 ‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿‿   SCALLOPED on all four edges, stamp-cut.
(░░░░░░░░░│ 21–27 JUL           )  ART PLATE — the week's own hue.
(░[front]░│ 1 of 4 days this wk )  COUNTERFOIL — the record. Paper,
(░[back]░░│ M T W T F S S       )  like the page.
(░░░░░░░░░│ Longest rested: …   )
 ) ·  ·  ·  ·  ·  ·  ·  ·  ·  · (   FOLD NOTCH at each end of the tear,
(  NEXT IN UPPER/LOWER │        )   perforation between them.
(  Legs                │[front] )  STUB — the instruction. Wears the
(  5 exercises · train…│[back]  )  routine's hue, because on a real
(  [ START ]           │        )  ticket the detachable part is the
 ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾    coloured one. Its art runs off the edge.
```

### How it was built

- `components/TrainingTicket.tsx` is one Panel with `padding: 0`, so each half
  can run its own colour field to the card's edge: `Counterfoil` (paper) and
  `Stub` (`ink.field` from the routine's hue). `WeekPanel` and `UpNextCard` are
  gone. `DayCell` moved to its own file, because the same cell has to mean the
  same thing in the ticket's one row and in the History page's six months.
- **The stub's four states are a discriminated union**, `TicketNext`, not a pile
  of optional props: live session / next routine / invitation / waiting. That is
  what makes "no routine yet" read as *one of the answers* rather than as a card
  with a hole in it, which is the whole reason the stub is never absent.
- **The silhouette is stamp-cut**: a scallop bitten out of every edge
  (`TicketEdge`), a big fold notch where the tear meets each side, and the
  perforation running between them. `SCALLOP` and `GAP` are `stamp-edge.tsx`'s own
  numbers, so a torn ticket and a postage stamp read as the same workshop.
- **The bites are painted in `colors.paper` on top of the card, not cut out of
  it.** A real cutout — the CSS mask and evenodd path `stamp-edge` uses — would
  mean none of the card's colour fields could run to its edges, and the art plate
  bleeding off the leading edge is the point of the counterfoil. The page behind
  is paper, so a paper bite is a hole.
- It also means the card keeps a rectangle's shadow while showing a scalloped
  edge. The bites are 3.5pt deep against a soft 8pt shadow, so there is nothing
  to see; a genuine cutout would have cost the shadow altogether on Android,
  where elevation follows a view's bounds and not its paint.
- **The scallops stop clear of the corners**, which leaves the radius the user
  chose a clean curve. A ticket is not allowed to take that decision back.
- **The tear is split between the halves rather than straddling them.** Each half
  draws one measured SVG of circles centred on the tear line, and the SVG's own
  viewport clips the rest — so neither half paints outside its own box and nothing
  is at the mercy of three platforms' overflow and z-order rules. Holes that would
  collide with a fold notch are dropped, so the perforation starts clear of it
  rather than blobbing into it.
- The stub prints its own `Grain`: the Panel's is under the colour field. It is
  clipped to a hole's radius, and the arc that leaves in each top corner is
  exactly the patch the end notch covers.
- The History key stays in the masthead — it is a page action, not a card's.

### The three decisions

**No routine yet → the stub becomes the invitation.** A ticket missing its stub
reads as torn, not as empty. The stub's job is "what to do next", so with no
programs it says how to get one — `Build your first routine`, below the
perforation, with no hue (a ticket for nothing is not a coloured ticket).

**A live session → the stub shows it, and does not control it.** `gym.tsx` used
to hide the whole hero while a workout ran, which threw away the week record
too, and that is still true and still worth seeing. When you are mid-session the
thing to do next *is* the session, so the stub carries it: the session's name,
sets logged, and a stamp reading **Resume** that taps through to the logger. It
must not grow pause/stop keys — the live bar above the dock already owns those
everywhere in the app, and a second controller is how two of them end up
disagreeing.

**Expanded history → out of the card, into its own screen.** The tension was that
six months of week rows grow the record half and push the stub off the bottom.
The real fault is that the card had two modes at all: "this week" and "your last
six months" are different questions, and the second one is not a state of the
first. So the masthead's History key pushes `(detail)/history` instead of
expanding in place.

That was the cheapest option as well as the clearest: `journeyWeeks()` and the
week-row rendering moved across nearly intact, and the ticket has no `open` prop,
no journey branch, and no "when expanded…" caveat anywhere. It is always exactly
one thing — this week, and what is next — which is what lets it be a ticket.

### What the halves say

Both halves are printed the way a ticket prints a value: a tracked uppercase
caption over it, in tabular figures.

- The counterfoil is captioned with the week itself — `21–27 JUL`, or
  `28 JUL–3 AUG` across a month boundary. Under it the headline, `1 of 4 days
  this week`: progress against what your split asks, not a tally you could count
  off the grid below it. Then the seven day keys, then what you have rested
  longest.
- The stub is captioned `NEXT IN <PROGRAM>`, which used to sit at the *end* of
  the meta line where the ellipsis ate it first. Then the routine, then
  `5 exercises · trained yesterday` — short enough now to actually read. Then the
  page's only Start. A live session captions itself `IN PROGRESS` and counts sets.
- **The art.** The counterfoil's figures stand in a full-bleed plate at the
  leading edge, which is where a ticket puts its picture, and the plate wears the
  hue the week itself came out — the accent that shaded the most muscles you
  actually trained, or the quietest possible wash if you trained nothing. The
  stub's figures run off the bottom edge instead of sitting in a frame, offset by
  the viewBox's dead foot margin so the *feet* land on the edge and not the box.
- Both pairs are drawn at one scale. They are two views of the same body on the
  same card, and two scales would read as a mistake rather than as a hierarchy.
- **No barcode.** It is the strongest ticket cue there is and it would encode
  nothing, which is exactly the decoration-without-a-job a metaphor here is not
  allowed to be. The punched holes and the caption type do the same work
  honestly.
