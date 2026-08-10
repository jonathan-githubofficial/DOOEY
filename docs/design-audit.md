# Design Sanitization Audit

Baseline taken 2026-07-25 against `frontend/` (93 source files).

The work list that turns [design-system.md](design-system.md) from a description of intent into a
description of the code.

**The worklist was executed on 2026-08-09** (140 source files by then). Steps 1 through 4 and 6
below are done; the scoreboard's numbers are the baseline, kept for the record. What the checker
still reports is the set of deliberate, documented exceptions:

- The crash screen in `app/_layout.tsx`: renders when the theme is the thing that broke, so it
  borrows nothing from it. Commented at the site.
- Physical light, which does not follow a palette: the plate's metal sheen (`plate.tsx`), the
  binder wire's specular gradient (`PlannerBook.tsx`), the login wall's picture-light
  (`login.tsx`). Each commented at the site.
- `GIF_PAPER` in `features/workouts/library.ts`: the exercise loops are drawn on flat white, so
  the mat behind one matches the asset, not the theme. The five thumb sites reference it.
- `anatomy.ts`: illustration data, exempt from the start.
- The page flip's back spring in `PlannerBook.tsx` (260/26/0.9, ratio 0.85): the one deliberate
  spring not driven by a finger, decided and documented in CLAUDE.md.
- `Waveform.tsx`'s beat loop: ambient by admission, documented in CLAUDE.md.

Still open, small and known: `AgendaSheet.tsx`'s fly-off (340ms, above the 220 ceiling; it reads
as a paper plane leaving and wants a deliberate decision, not a mechanical clamp) and its 700ms
delete-arming pulse (an ambient loop that should probably be `ambient.breath`).

**Start with the good news.** `frontend/` is in far better shape than the frozen web app was.
`alpha()` is used in 41 files, `usePalette()` and `useType()` are the norm, `<PressableScale>` is a
single shared press primitive whose springs are already tuned near-critical with a comment saying
"no wobble or overshoot", and hover lift was deliberately rejected. The architecture is right. What
follows is drift around the edges of it, and one motion habit that contradicts what the app is
supposed to feel like.

---

## Scoreboard

| Category | Found | Should be | Kind |
|---|---|---|---|
| `shadowColor` literals | **21** in 16 files | 0 (`useElevation()`) | Ownership |
| Hex colour literals | **34** | 0 | Ownership |
| Raw `rgba()` literals | **12** | 0 (`alpha()`) | Ownership |
| Card radii ignoring the user | **~14** | 0 (`useCardRadius()`) | Ownership |
| Springs that visibly bounce | **6 of 15** | 0 | Motion |
| Springs not driven by a gesture | **6** | 0 | Motion |

Ownership findings are the priority. They are the ones the user can actually see the moment they
open the Style page and change something.

Run the checker for live numbers:

```bash
bash .claude/skills/design-system/scripts/design-check.sh
```

---

## Ownership findings

### 1. Shadows do not belong to the user

`shadowColor: "#282018"` appears **21 times across 16 files**, including inside `<Panel>` itself
(`components/surface.tsx:134`). It is a warm dark brown, correct for the factory Dooey palette and
wrong for every other one.

The consequence is easy to see: switch to Charcoal or Tide in the Style page. Everything turns cool
grey or blue, and every shadow in the app stays warm brown. The user changed their theme and the app
only half agreed.

`useElevation()` in `frontend/src/stores/theme.ts` now returns the whole shadow style, tinted from
their `ink` and scaled by their shadow slider. Replacing the 21 literals is mechanical.

It also collapses a duplication: those 21 sites each hand-write `shadowColor`, `shadowOpacity`,
`shadowRadius`, `shadowOffset`, and `elevation`, with values that have drifted apart.

### 2. Thirty-four hardcoded colours

- `"#282018"` ×21, the shadow tint above.
- `"#fff"` / `"#ffffff"` ×13, spread across `stamp-edge.tsx`, `sheet.tsx`, `plate.tsx`,
  `TaskComposer.tsx`, `KeyPad.tsx`, `workout/[id].tsx` and others.

Pure white is the subtle one. On warm paper it already reads slightly cold, and when the user picks
a warm or dark theme it stays stubbornly `#ffffff`. Where it is being used as "brighter than the
surface", that is `relight()`. Where it is a genuine highlight on a skeuomorphic edge, it should at
minimum be `alpha(colors.paper, x)` so it tracks the theme.

One is legitimate and should stay: `anatomy.ts` holds anatomical figure colours, which are
illustration data, not UI chrome. Confirm before changing it.

### 3. Twelve raw `rgba()` literals

`rgba(20, 16, 12, 0.35)` ×4, `rgba(255,255,255,0.4)`, `rgba(0,0,0,0.22)`, and similar. Same problem
as above: frozen at the factory default, does not invert, does not follow the palette. `alpha()`
exists and 41 files already use it.

### 4. Card radii the slider cannot move

Only **5 files** call `useCardRadius()`, while roughly **14 sites** hardcode a card-sized radius
(`16` ×10, `20` ×3, `24` ×1). Those surfaces will not respond when the user moves the radius slider,
so the app ends up with some corners following them and some not, which looks more broken than if
none did.

Not a violation: `borderRadius: 99` ×95 is the pill idiom, and small control radii (chips, inputs,
under about 12) are allowed to be fixed. Worth noting that `99` would read better as a named
constant, but it is at least consistent.

---

## Motion findings

### 5. Six springs bounce, and the app is not supposed to bounce

Damping ratio is `damping / (2 * sqrt(stiffness * mass))`. Below about 0.8 a spring visibly
overshoots. Computed across all 15 spring configs:

| Ratio | Config | Site | What it is |
|---|---|---|---|
| **0.31** | `380/12` | `components/BootIntro.tsx:106` | Boot animation |
| **0.39** | `520/18` | `components/Check.tsx:28` | The checkbox tick |
| **0.44** | `320/15 m0.9` | `components/BootIntro.tsx:84` | Boot animation, staggered |
| **0.63** | `420/26` | `app/(detail)/board/[id].tsx:361` | Board object lift |
| **0.78** | `420/32` | `features/tasks/components/TimeboxSheet.tsx:321` | Time block lift |
| 0.83 | `420/34` | `AgendaSheet.tsx:52` (`LIFT`) | Swipe reveal |
| 0.85 | `260/26 m0.9` | `features/tasks/components/PlannerBook.tsx:208` | Page turn — **settled**, see above |
| 0.84 | `320/30` | `components/sheet.tsx:56` | Sheet entry |
| 0.89 | `500/40` | `TimeboxSheet.tsx:276` | Drag snap to slot |
| 0.98 | `550/46`, `700/52` | `pressable-scale.tsx` | Press and release |

The split is not arbitrary. **Every spring that passes is driven by a finger. Every spring that
fails is decoration.** The gesture springs were tuned by feel against a real interaction and landed
in the right place; the decorative ones were tuned by feel against nothing.

The checkbox at 0.39 is the clearest case. A tick that springs past its size and settles back is a
spring doing a job nobody asked for: the state changed instantly, and the animation is narrating
that fact with a flourish. `withTiming(1, timing(dur.instant))` says the same thing in 110ms
without the wobble.

`BootIntro` at 0.31 and 0.44 is the most visible, since it is the first thing the app does.

The two lifts (0.63, 0.78) are the interesting middle. They *are* gesture-adjacent: something is
being picked up. But the lift is a state change (this is now held), not a value the finger is
driving, so it wants `timing(dur.instant)`. Reserve `gesture.*` for values that track the finger's
actual position.

`PlannerBook` was the one genuine judgement call and it has been decided: damping went 22 to 26 on
2026-08-09, taking the ratio from 0.72 to 0.85. A page turn is a physical metaphor and some overshoot
was arguably the point, but a page that overshoots past flat has gone through the pad, so the
metaphor argued for settling rather than bouncing. It stays a spring, which is the app's one
exception to "no finger, no spring": the flip is a physical object landing, not a state change.

### 6. Six springs where a timing curve was meant

Same six. Restating it as a rule rather than a list, because it is the one that generalizes:

> A spring models something with mass that a hand is moving. If nothing is being dragged or swiped,
> the animation is explaining a change, and a change is explained with a duration and a curve.

### 7. Eighteen spring entrances the checker used to be blind to

Found 2026-07-25, after the owner pointed out that the sheet still rose with a spring despite the
rule above. Reanimated's builders spell a spring a second way — `SlideInDown.springify()
.stiffness(300).damping(30)`, `LinearTransition.springify()...` — and the damping-ratio rule only
ever matched the `{ stiffness, damping }` object literal, so **none of these were ever reported**.
The checker now computes ratios for the chained form too.

Eighteen sites across the app, five of which bounce (ratio below 0.8):

| Ratio | Where |
|---|---|
| **0.73** | `app/(detail)/workout/[id].tsx:640` |
| **0.78** | `app/(detail)/task/[id].tsx:38` |
| **0.78** | `features/tasks/components/AgendaSheet.tsx:44` |
| **0.78** | `app/(detail)/project/[id].tsx:19` |
| **0.78** | `features/tasks/components/TimeboxSheet.tsx:25` |

The remaining thirteen sit between 0.80 and 0.87: they do not visibly overshoot, but they are still
springs on entrances and layout settles, which rule 6 says should be curves.

Already fixed, because they were the surface the complaint was about: `components/sheet.tsx` (the
drawer's rise, the menu unfold, the layout settle) and `components/DoodleEditor.tsx` (a 0.73
entrance). The rest are untouched.

---

## Migration order

Ownership first, because it is what the user can see; motion second, because it is smaller than it
looks. Each step is independently shippable.

**Step 1. `useElevation()` across the 21 `shadowColor` sites.** ✔ Done 2026-08-09. True resting
cards (`Panel`, the dock island, the zoom stepper, `LiveBar`, the picker cards) took
`useElevation()` whole. Sites whose geometry is deliberate (the stamp silhouettes, the plate, the
binder rings, the toggle knob, the keypad's upward shadow, the login hero) kept their shape and
took the two things that were stolen: tint from `colors.ink` and scale from the shadow slider. The
drag-lift shadows in `TimeboxSheet` and `AgendaSheet` now also scale with the slider inside their
worklets.

**Step 2. The remaining colour literals.** ✔ Done 2026-08-09. Scrims became `alpha(colors.ink, x)`,
text-on-accent became `colors.paper`, GIF mats became `GIF_PAPER`, and the physical-light sites
were kept and commented (see the exception list at the top).

**Step 3. Card radii onto `useCardRadius()`.** ✔ Done 2026-08-09. The login card, both dashed
add-tiles, the rambler draft cards, the program deal slot and the exercise detail card follow the
slider; the Style page's 64pt doodle tiles follow it clamped at 20 so a tile stays a tile (the
`Key` precedent). The week tray and month grid keep `12 + 4`: concentric with the 12pt chips they
hold, a well rather than a card, written as the derivation it is.

**Step 4. The four clearly decorative springs.** ✔ Done 2026-08-09. `Check`'s tick, both
`BootIntro` calls and both `TimeboxSheet` lift scales are `timing(dur.instant)`. The dot still
pops to 1.4 and settles, as two timing curves rather than a wobble. Also caught: the theme
toggle's RN-Animated knob spring (500/32, ratio 0.72; invisible to the checker, which only reads
reanimated) raised to damping 45, ratio 1.0.

**Step 5. Decide on `PlannerBook`.** ✔ Decided during the 2026-08-09 flip rebuild: the desk-calendar
page turn is the app's one deliberate non-gesture spring, near-critical at 260/26/0.9 (ratio 0.85).

**Step 6. Mount `<ReducedMotionConfig mode={ReduceMotion.System} />` at the app root.** ✔ Done
2026-08-09, in `frontend/src/app/_layout.tsx`.

---

## Legacy web app

The frozen Vite app in root `src/` was audited on the same day, before it was clear it had been
superseded. Those findings (20 spring configs, 21 enter variants, 18 arbitrary shadows, 35 raw
z-indexes, 3 hand-rolled modals with no focus trap) are real but **not worth acting on**: the app is
frozen, last committed 2026-07-18, and the only live thing it still owns is materializing
learning-program sessions into tasks.

`src/lib/motion.ts` and `src/components/sheet.tsx` were written for it in that same pass. They are
uncommitted and target a dead target. Delete them, or leave them; do not port them, because their
motion philosophy (five springs, deliberate overshoot, "things settle") is the one this document
now replaces.

---

## Keeping it clean

- [`.claude/skills/design-system/`](../.claude/skills/design-system/SKILL.md) checks a diff against
  these rules, including computing damping ratios.
- [design-system.md](design-system.md) is the reference. Read it before UI work, not after.
- Re-run the checker after each step and update the scoreboard here, so the numbers going to zero
  are visible.
