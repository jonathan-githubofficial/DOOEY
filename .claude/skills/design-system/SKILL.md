---
name: design-system
description: Use before writing or reviewing any DOOEY UI code in mobile/, and whenever a change touches colour, radius, shadow, typography, animation, or a shared primitive. Loads the design tokens and motion rules from docs/design-system.md, then checks the work against them so every screen stays consistent and stays under the user's control from the Style page. Trigger on "add a page", "build a component", "style this", "animate this", "add a sheet", "design check", "is this consistent", or any request to audit or clean up the app's styling and animations.
---

# DOOEY Design System

**Scope: the Expo app in `mobile/`.** Root `src/` is a frozen legacy Vite app with a different
styling system, router and animation library. Do not apply these rules to it and do not copy its
patterns into `mobile/`.

## Overview

DOOEY is a notebook you customize. The Style page is not a settings screen bolted on the side; it is
the point of the app. The user picks the palette, the fonts, the corner radius, the shadow depth,
the grain, the backdrops, the doodles on their tab icons.

Two rules follow from that, and they outrank everything else.

> **1. A hardcoded value is a value stolen from the user.**
>
> **2. Motion has to do a job, or it does not happen.**

The first is the ownership rule. A literal `"#282018"` is not just inconsistent, it is a corner of
the app the user cannot reach, and it will still look like the factory theme after they have made
everything else theirs.

The second is the motion rule. DOOEY is a considered-micro-interactions app, not a springy one.
Nothing bounces, nothing overshoots, nothing animates to fill silence.

## Always read first

Read [docs/design-system.md](../../../docs/design-system.md) before writing UI code. It is short and
it has the full tables. [docs/design-audit.md](../../../docs/design-audit.md) lists known drift and
the migration order; check it before "fixing" something, because it may already be scheduled and the
audit says which direction the fix goes.

## Ownership: whose decision is this?

When you are about to type a value, ask whether the user would plausibly want it different. If yes,
it is theirs.

| Need | Use | Never |
|---|---|---|
| Any colour | `usePalette()` | a hex literal |
| Transparency | `alpha(colors.x, 0.35)` | `rgba(20, 16, 12, 0.35)` |
| Brighter than the surface | `relight()` | `"#fff"` |
| Card corners | `useCardRadius()` | `borderRadius: 24` |
| Shadow | `useElevation("rest" \| "lifted")` | `shadowColor:` by hand |
| Fonts | `useType()` | naming a family |

`useElevation` tints the shadow from the user's own `ink` and scales it by their shadow slider.
Hardcoding `shadowColor` is the most common ownership violation in the app: 21 sites, and it is why
shadows stay warm brown on a cool theme.

Exempt: `features/workouts/anatomy.ts` holds anatomical figure colours, which are illustration data
rather than UI chrome.

## Motion: what job does this do?

Three jobs, and anything doing none of them does not animate.

1. **Follow the finger.** Drag, swipe, scroll. **The only place a spring belongs.**
2. **Explain a change.** Something appeared, moved or left, and the user would otherwise have to
   re-find it. A short timing curve.
3. **Confirm an action.** The press dip, the tick. Small, immediate, over.

The test before adding any animation: **"what would the user lose if this were instant?"** If the
honest answer is nothing, make it instant. Most of the app should be.

### No wobble, and it is measurable

```
ratio = damping / (2 * sqrt(stiffness * mass))
```

Below 0.8 a spring visibly overshoots. **The system requires 0.8 or above** and the checker computes
it. This is not a matter of taste to relitigate per component; it is the house rule.

| Need | Use |
|---|---|
| Press dip / release | `<PressableScale>` (already applies `gesture.press` / `gesture.release`) |
| Drag released into a slot | `gesture.snap` |
| Swipe tracking out and back | `gesture.track` |
| Anything not driven by a finger | `timing()` |

`dur.instant` 110 · `dur.quick` 160 (default) · `dur.moved` 220 (**the ceiling**).
`ease.out` (default) · `ease.in` · `ease.inOut`. Never linear.

A persistent "still running" indicator is the one exception to the ceiling: `ambient.breath`.

Reduced motion is carried by every config in `motion.ts` via `ReduceMotion.System`. Do not add a
`useReducedMotion()` branch.

## Primitives

Check `mobile/src/components/` before building: `Panel`, `PressableScale`, `Sheet`, `Check`,
`Eyebrow`, `Stamp`, `Grain`, `StampEdge`, `Plate`, `Dock`, `Masthead`, `DoodleSvg`.

Feature UI lives in `mobile/src/features/<feature>/components/`. If two features reach for the same
thing, it moves to `mobile/src/components/` or `mobile/src/lib/`.

## Checking work

```bash
bash .claude/skills/design-system/scripts/design-check.sh --diff
```

Without `--diff` it scans all of `mobile/src`. It greps for ownership violations and computes the
damping ratio of every spring.

**Read every hit before reporting it.** It is a grep: it matches inside strings and comments, and
some hits are documented exceptions. A hit you have not opened is not a finding. Cross-check against
`docs/design-audit.md` and separate **new drift in this change** from **pre-existing and already
tracked**.

Then verify what grep cannot:

- [ ] **Open the Style page. Change the palette, the radius, and the shadow slider.** Anything that
      does not move is holding a value that belongs to the user. This is the single most valuable
      check in this file.
- [ ] Light and dark both rendered.
- [ ] Reduced motion on, nothing invisible or stuck.
- [ ] `cd mobile && npm run typecheck && npm run lint`.

Report each finding as `file:line` with what replaces the value. If it is clean, say so rather than
manufacturing findings.

## Extending the system

1. **Two uses make a token.** The second time a value is typed by hand, move it to its owner.
2. **A new colour needs a role, not a look**, and it needs adding to `tokens.ts` for both modes, or
   the Style page cannot reach it.
3. **A new spring needs a gesture.** No finger, no spring.
4. **Document it in `docs/design-system.md` in the same change.**

## Red flags

- Typing a colour, a radius, or a shadow. Ask whose decision it is.
- Tuning a `damping` value until it "feels bouncy". That is the thing this app does not do.
- Adding an animation because a screen felt static. Static is fine. Static is a notebook.
- A stagger on a list. Ask what the user loses without it.
- Reaching for `withSpring` when nothing is being dragged.
- Copying a block of styles from another component. Extract the primitive.
- `useReducedMotion()`. Already handled.

## Reference

- [reference.md](reference.md): the token tables, for lookup without leaving the skill.
- [scripts/design-check.sh](scripts/design-check.sh): the checker.
