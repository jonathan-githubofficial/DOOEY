# Gym page redesign — design

**Date:** 2026-07-25
**Scope:** `mobile/src/app/(tabs)/gym.tsx` and the components it grows into.

## Goal

Make the Gym tab **launch you into training in one glance**, and make the browse surface below it
worth looking at — a board of your routines, in DOOEY's paper-object language.

Two constraints govern every decision here, and they pull against each other:

- **Glanceable.** You should know what to tap without reading. Colour and silhouette do the work
  that text does today.
- **Playful.** Personality comes from objects that *carry meaning* — a colour spine, a body
  silhouette, a rubber stamp — never from decoration layered on top.

Where they conflict, glanceable wins.

## Non-goals

- No changes to the routine editor, the live logger, or `ProgramsExplorer`.
- No schema change. Everything new is derived client-side from data already fetched.
- No new dependencies.
- No masonry library — a two-column packer is ~30 lines.
- Reduced-motion handling is **not** addressed. The mobile app has no reduced-motion affordance
  anywhere today (`AccessibilityInfo` appears nowhere in `mobile/src`). This redesign introduces no
  new animation primitives — only `FadeInDown`, `LinearTransition` and `PressableScale`, all already
  in use — so it neither improves nor regresses that gap. Fixing it app-wide is separate work.

## Why the page needs this

The current page is a filing cabinet. Concretely:

- Everything lives inside a hand-rolled `folderBody` box ([gym.tsx:766-779]) with 8px side padding,
  so Gym reads noticeably tighter than Boards/Projects/Account (which use 20–28px panels).
- That box hardcodes `borderRadius: 16` and `shadowOpacity: 0.07`, bypassing `useCardRadius()` and
  `useShadow()`. Push the radius slider in Style studio and Gym visibly desyncs from every other
  surface. `folderTab` (r12) and `addTile` (r16) have the same bug.
- Gym is the only tab that hand-rolls its header instead of using `Masthead`, with drifted values
  (`letterSpacing: -1` vs `-0.7`, gap 12 vs 14).
- There is **no primary action object** on the page. Starting a workout is one screen deep. The
  app's cast-metal `Plate` — its "commit" object everywhere else — never appears.
- The dominant muscle of a routine is computed (`focusOf`, [gym.tsx:101-114]) and then expressed as
  an 8px dot. `MuscleMap`, the gym's strongest visual asset, only exists inside `ExercisePicker`.
- The page answers "what are all my routines?" but never "what do I do today?" — which the
  [gym-ux-plan](../../../mobile/docs/gym-ux-plan.md) names as the north star.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| What the page is for | **Launchpad first, board second** | Pure board (prettiest, but "what do I do today" gets no treatment); trophy case (motivating, but not a launchpad) |
| Library layout | **2-col masonry on bare paper** | Full-width single column (safest, less board-like); masonry inside the folder box (keeps the cramped chrome) |
| Workout/History control | **Planner's pressed-tray + raised paper key** | Keep folder tabs (a folder tab with no folder under it reads orphaned) |
| "Up next" logic | **Rotation by `position` within the program** | Freshest-muscle tally (smarter, but arbitrary-feeling and contradicts "simple first, smart later"); no prediction (honest, but it's a menu, not a nudge) |
| Card imagery | **One lead demo per masonry card** | 3-tile mosaic at half-width is mush, and doubles simultaneous GIFs |
| Focus expression | **Colour spine + caption tint** | The current 8px dot — too small to scan by |

## Page anatomy

```
┌─────────────────────────────────────┐
│  ✎  Gym          ╭──────────────╮   │  Masthead + PageDoodle
│                  │░╭─────╮░░░░░░│   │  pressed tray, raised key
│                  │░│Workt│ Hist │   │
│                  ╰──────────────╯   │
│  ╔═══════════════════════════════╗  │
│  ║ ▓▓▓ mosaic ▓▓▓▓▓▓▓▓    ╭─╮    ║  │  HERO — full-bleed 180px
│  ║ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │█│    ║  │  MuscleMap disc, focus hue
│  ║ ⟨UP NEXT⟩ stamp, −3°  ╰─╯    ║  │
│  ║───────────────────────────────║  │
│  ║ PUSH / PULL / LEGS            ║  │  Eyebrow
│  ║ Pull                          ║  │  26px display
│  ║ back · 6 exercises            ║  │
│  ║ last done 5 days ago          ║  │
│  ║      ▐█ START WORKOUT █▌      ║  │  Plate — the only one
│  ╚═══════════════════════════════╝  │
│                                     │
│  THIS WEEK              3 days      │  doodled ticks, hue-struck
│  ╱  ╱  |  ╱  ⊙  |  |                │
│                                     │
│  PUSH / PULL / LEGS        2   ⌄ ⋯  │  Eyebrow-scale section rule
│  ┃┌───────┐   ┌───────┐             │
│  ┃│▓▓▓▓▓▓▓│   │▓▓▓▓▓▓▓│             │  masonry, ±0.8° lean
│  ┃│▓▓▓▓▓▓▓│   │ Pull  │             │  ┃ = focus-hue spine
│  ┃│▓▓▓ ╭─╮│   └───────┘             │
│  ┃│ Push╰─╯│  ┌───────┐             │
│  ┃└───────┘   │ + add │             │
│               └╌╌╌╌╌╌╌┘             │
└─────────────────────────────────────┘
```

## Derived data

All of it is a pure function over `useWorkouts()` (last 60 sessions, newest first) and
`useRoutines()` / `usePrograms()`. No new queries.

### `features/workouts/rotation.ts` (new)

```ts
/** The routine to train next: the one after your last session's routine, by
 *  position within its program. Wraps. */
nextUp(routines: Routine[], programs: WorkoutProgram[], workouts: Workout[]): Routine | null

/** When a routine was last finished — ISO, or null if never. */
lastDoneAt(routineId: string, workouts: Workout[]): string | null

/** "today" | "yesterday" | "5 days ago" | "never" */
sinceLabel(iso: string | null): string

/** Mon→Sun of the local current week; each day carries the focus hue of that
 *  day's first finished session, or null. */
weekRhythm(workouts: Workout[], colors: Palette): { date: Date; hue: string | null }[]
```

**`nextUp` rules, in order:**

1. Take the most recent **finished** workout whose `routine` id still resolves to a live `Routine`.
2. Take that routine's program; sort its routines by `position`; return the next one, wrapping to
   the first.
3. If no session resolves (never trained, only ad-hoc sessions, or the routine was deleted), return
   the first routine of the first program by `position`.
4. If there are no routines at all, return `null`.

A program with one routine returns that routine — repeating a single routine is correct behaviour,
not an edge case to special-case.

### `prSessions` — new, in `features/workouts/api.ts`

`personalRecords()` ([api.ts:334]) gives all-time bests *including* the session you're asking about,
so it can't answer "did this session set a PR". A separate single pass does:

```ts
/** Session ids that set a personal best when they happened — one pass
 *  oldest→newest, comparing each set against the record so far. */
prSessions(workouts: Workout[]): Set<string>
```

O(sets), one traversal. Lives beside `personalRecords` because it's the same family.

## Components

`gym.tsx` is 878 lines today and this would push it past 1,200. It splits along real seams; each
new file has one job and is understandable without reading the page.

| File | Responsibility |
|---|---|
| `features/workouts/rotation.ts` | The four pure derivations above. No React. |
| `features/workouts/focus.ts` | `MUSCLE_HUE`, `focusOf()`, `cardGifs()` — moved verbatim out of `gym.tsx`. No React. |
| `features/workouts/components/UpNextCard.tsx` | The hero. Props: `routine`, `program`, `lastDone`, `onStart`, `onOpen`. |
| `features/workouts/components/WeekRhythm.tsx` | The seven ticks. Props: `days` (from `weekRhythm`). |
| `features/workouts/components/Masonry.tsx` | Generic two-column packer. Props: `items`, `estimateHeight`, `renderItem`. |
| `features/workouts/components/card-parts.tsx` | Shared `LeadDemo`, `MosaicBand`, `EmptyBand`, `BandMenu`, `FocusSpine`. |
| `features/workouts/components/RoutineCard.tsx` | A routine as a board card. |
| `features/workouts/components/HistoryCard.tsx` | A finished session as a board card. Props include `isPR: boolean`. |
| `app/(tabs)/gym.tsx` | The page only: Masthead, toggle, hero slot, sections, sheets, mutations. |

`ProgramsExplorer`, `ActionSheet` and `PromptSheet` are untouched.

**One existing component changes:** `MuscleMap` gains an optional `tint?: string` prop, defaulting
to `colors.clay` so both current call sites in `ExercisePicker` are unaffected. Without it the
figure can't be drawn in a routine's focus hue, which the hero and tall cards both need.

### What renders on which tab

The hero and the week rhythm are **Workout-tab only**. `LiveBanner` renders above both tabs, as it
does today.

## Visual specification

Everything reads from `usePalette()`, `useType()`, `useCardRadius()`, `useShadow()`. No hardcoded
colour, radius or shadow — that's the bug being fixed, not a pattern to copy.

### Shell

- `Masthead` with `avatar={<PageDoodle page="gym" />}`, title `Gym`, and the toggle as `children`.
- Page gutters `paddingHorizontal: 16`, `marginTop: 24` from Masthead to hero, `96` bottom clearance.
- `folderBody`, `folderTab`, `folderTabTick`, `FolderTab` are **deleted**.

### Workout / History toggle

Ported from the Planner's mode toggle ([index.tsx:243-274]): a recessed well at
`alpha(ink, 0.05)`, `borderRadius: 999`, holding two keys. The active key is `surface` with an
`alpha(rule, 0.7)` border and a soft shadow — a raised paper key in a pressed tray. 12.5px
`sansSemiBold`, active `ink` / inactive `inkMuted`. `hapticTap()` on change.

### Hero — `UpNextCard`

- `Panel` with `padding: 0`, inner clip at `radius - 1` for the band.
- **Band** 180px, the 3-tile `MosaicBand` (unchanged logic, taller). `EmptyBand` when the routine
  has no library-backed exercises.
- **`UP NEXT` stamp** — `<Stamp color={colors.zest} rotate={-3}>` floated top-left of the band at
  16/16, over an `alpha(ink, 0.34)` backing so it stays legible on any demo frame.
- **MuscleMap disc** — bottom-right of the band, a 92px `surface` circle with an
  `alpha(rule, 0.7)` ring and a soft shadow, holding
  `<MuscleMap targets={…} scale={0.34} tint={focus.hue} />`. Overlaps the band's bottom edge by
  ~14px so it breaks the caption line — the one deliberate overlap on the page.
- **Caption** `padding: 20`: `Eyebrow` with the program name, routine name at 26px `type.display`
  (`letterSpacing: -0.5`), then a meta line `<focus> · N exercises`, then the `sinceLabel` line in
  `inkMuted` 12.5px — `last done 5 days ago`, or `not trained yet` when it's never been run.
- **`Plate label="Start workout"`**, full-width, `marginTop: 16`.
- Tapping the band or the name opens the routine page; only the Plate starts the session.
- **When a session is live**, `LiveBanner` renders **instead of** the hero — never both.
- While `programs` is loading or the starter program is seeding, the hero renders a quiet
  placeholder `Panel` at the hero's height rather than collapsing the layout.

### Week rhythm

One row, `marginTop: 20`. `Eyebrow` `THIS WEEK` on the left, `3 days` on the right in
`fontStyle("fraunces", "700")` with `fontVariant: ["tabular-nums"]`.

Below it, seven marks Mon→Sun drawn as short SVG strokes in the app's doodle language: an untrained
day is a faint `alpha(inkMuted, 0.3)` vertical tick; a trained day is a struck diagonal in that
session's focus hue; today carries a thin ring. The tally counts trained days only — no "of 7",
which would imply a target the app doesn't have.

### Masonry

Two columns, 12px gutter, greedy shortest-column packing on an estimated height so it's
deterministic across renders:

```
estimate = bandHeight + 76        // caption is fixed-height
bandHeight = items.length <= 3 ? 104        // short
           : items.length <= 6 ? 132        // medium
           :                     168        // tall
```

Cards lean by index: `[-0.8, 0.6, -0.4, 0.9][i % 4]` degrees — the same trick as
[ExercisePicker.tsx:338]. Entrance stays `FadeInDown.delay(i * 40).duration(220)`.

### `RoutineCard`

- `Panel`, `padding: 0`, band clipped to `radius - 1` at the top.
- **One lead demo**, not a mosaic — `cardGifs()[0]`, with a `+N` chip when more remain.
- **Focus spine** — a 4px bar in the focus hue down the card's left edge, full height, corners
  matched to the panel. Modelled on the Projects accent spine ([projects.tsx:131-139]).
- **Caption** `padding: 14/12`: name at 18px `type.display`, then one meta line
  `<focus> · N exercises`. The `description` no longer appears on the card — it lives on the
  routine page. The 8px focus dot is gone; the spine replaces it.
- Caption background carries the focus hue at ~4% as a tint.
- **MuscleMap cutout on tall cards only** (7+ exercises): a 56px disc bottom-right of the band.
  The rule is meaningful rather than decorative — a long routine is exactly the one whose name
  tells you least about what it trains, so it earns the figure; a 3-exercise routine is
  self-evident. It also caps how many SVG figures render at once.
- `BandMenu` (⋯) unchanged — duplicate / delete.

### `HistoryCard`

Same card shell, with `workout.title` as the name. Additions:

- The date renders as a `<Stamp color={inkMuted} rotate={-3}>` floated **top-left of the band** —
  the slot the hero gives its `UP NEXT` stamp — instead of plain 12px text in the caption, matching
  [AgendaSheet.tsx:256].
- A clay `<Stamp rotate={4}>PR</Stamp>` in the band's **top-right** when `isPR` is set, so the two
  stamps never collide.
- The `statsRow` (time / volume / exercises) stays, but drops to two stats — time and volume —
  since exercise count is already in the meta line and the card is half-width now.
- History cards keep today's long-press-to-delete and gain no `BandMenu`, which is why the PR stamp
  can own the band's top-right. Surfacing a visible delete here is listed in the
  [gym-ux-plan](../../../mobile/docs/gym-ux-plan.md) and stays out of this change.

### Section rules

Program headers shrink from 20px `type.display` to `Eyebrow` scale (10px, `letterSpacing: 1.8`,
uppercase, `inkMuted`), with the routine count, a collapse chevron and the ⋯ menu on the right. A
hairline `alpha(rule, 0.5)` rule runs under the label. This is the change that stops program names
from competing with routine names for the eye.

### Add-routine tile

Stays a dashed tile but becomes a masonry item: `borderRadius: useCardRadius()`, a doodle mark
above the label, `PressableScale` at 0.96.

## Edge cases

| Case | Behaviour |
|---|---|
| No programs yet (first open, seeding) | Hero shows the placeholder panel; the existing "Setting up your starter program…" line stays |
| Programs exist, no routines | Hero shows an empty state — doodle + "Build your first routine" + a Plate that creates one |
| Live session running | `LiveBanner` replaces the hero entirely |
| Last session's routine was deleted | `nextUp` falls through to the next resolvable session, then to the first routine |
| Only ad-hoc sessions ever logged | `nextUp` returns the first routine of the first program |
| Program has one routine | `nextUp` returns it — repeating is correct |
| Routine with no library-backed exercises | `EmptyBand`; no MuscleMap disc; neutral spine |
| Odd number of masonry cards | Shortest-column packing leaves one column short; no filler |
| Very long routine name | `numberOfLines={1}` everywhere, as today |

## Testing

There are no tests in `mobile/` today, so this doesn't invent a framework. Verification is:

1. **`rotation.ts` is pure and hand-checkable** — the four functions take plain arrays and return
   plain values. Each rule in the `nextUp` list above is walked manually against a seeded PPL
   program: fresh account, after Push, after a deleted routine, after an ad-hoc session.
2. **Visual pass in the running app** (`npm run start` in `mobile/`), light and dark, on:
   the seeded starter program; a gym with 2 programs and 8 routines; an empty gym; a live session;
   a history with and without a PR.
3. **Style-token pass** — drag radius to 0 and to 3rem, and shadow to 0 and 2, in Style studio.
   Every Gym surface must move with the rest of the app. This is the regression the current
   hardcoded values would fail.

## Risks

- **GIF density.** More cards fit on screen in two columns. Mitigated by one lead demo per card
  instead of three; net simultaneous GIFs should fall, not rise. Worth watching on a real device.
- **MuscleMap cost.** Each figure is a stack of SVG paths. Capped to the hero plus tall cards. If it
  drags, the fallback is hero-only and the tall-card rule is deleted — the spine still carries the
  focus signal, so nothing is lost but flourish.
- **Masonry reading order.** Two columns rendered as two `View`s means screen-reader order is
  column-by-column, not visual row order. Acceptable for a card wall where each card is
  self-describing via `accessibilityLabel`.
- **Deleting the folder metaphor** removes a tie to the Projects page. The file-folder language
  stays alive on Projects, where it maps to a real thing (a program is a folder of sessions); on
  Gym it was wrapping the whole page, which is what made it feel boxed in.

[gym.tsx:766-779]: ../../../mobile/src/app/(tabs)/gym.tsx#L766-L779
[gym.tsx:101-114]: ../../../mobile/src/app/(tabs)/gym.tsx#L101-L114
[api.ts:334]: ../../../mobile/src/features/workouts/api.ts#L334
[index.tsx:243-274]: ../../../mobile/src/app/(tabs)/index.tsx#L243-L274
[projects.tsx:131-139]: ../../../mobile/src/app/(tabs)/projects.tsx#L131-L139
[ExercisePicker.tsx:338]: ../../../mobile/src/features/workouts/components/ExercisePicker.tsx#L338
[AgendaSheet.tsx:256]: ../../../mobile/src/features/tasks/components/AgendaSheet.tsx#L256
