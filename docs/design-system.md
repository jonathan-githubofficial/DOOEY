# DOOEY Design System

The single source of truth for how DOOEY looks and moves.

**Scope: the Expo app in `mobile/`.** The Vite app in root `src/` is frozen legacy and has its own
Tailwind and `motion/react` setup that none of this touches. See
[Legacy web app](../CLAUDE.md#legacy-web-app-frozen).

Companion documents:

- [design-audit.md](design-audit.md): the live list of places that violate this, and the order to fix them.
- [.claude/skills/design-system/SKILL.md](../.claude/skills/design-system/SKILL.md): the skill that checks new work against this.

---

## The first principle: you own it

DOOEY is a notebook you customize. The Style page is not a settings screen bolted onto the side of
the app; it is the point of the app. Palette, fonts, corner radius, shadow depth, grain, backdrops,
the doodles on the tab icons, the wordmark: the user picked all of it, and it should reach
everywhere.

Which makes this the rule that outranks the rest:

> **A hardcoded value is a value stolen from the user.**

A literal `"#282018"` is not just an inconsistency. It is a corner of the app the user cannot reach,
and it will keep looking like the factory theme after they have made everything else theirs. When you
find yourself typing a colour, a radius, or a shadow, the question is not "does this look right",
it is "whose decision is this". It is theirs.

The corollary is **tasteful by construction**. The user picks the values; the system makes sure any
combination they pick still holds together. That is why radius is one token and not fourteen, why
there are two elevation levels and not five, and why shadow tint derives from their ink rather than
sitting next to it. They get the freedom; the constraints keep it from turning ugly.

Everything below is in service of those two sentences.

---

## Where things live

| Concern | Owner | Never |
|---|---|---|
| Palette, presets, fonts, backdrops, doodle pages | `mobile/src/features/style/tokens.ts` | A colour the Style page cannot reach |
| `Palette` type, `alpha()`, `relight()` | `mobile/src/lib/theme.ts` | A raw `rgba()` literal |
| Live palette, type, elevation | `mobile/src/stores/theme.ts` (`usePalette`, `useType`, `useElevation`) | `shadowColor:` written by hand |
| Radius and shadow strength | `mobile/src/features/style/store.ts` (`useCardRadius`, `useShadow`) | A literal `borderRadius: 24` on a card |
| Durations, easings, gesture springs | `mobile/src/lib/motion.ts` | An inline `withSpring` config |
| Shared primitives | `mobile/src/components/` | Rebuilding one that exists |

---

## Colour

Ten tokens, all user-overridable per mode, resolved through `usePalette()`.

| Token | Role |
|---|---|
| `paper` | Page background |
| `surface` | Cards and panels |
| `ink` | Primary text, and the tint every shadow derives from |
| `inkMuted` | Secondary text, eyebrows, captions |
| `rule` | Borders and hairlines. Panels use `alpha(colors.rule, 0.7)` |
| `zest` | The accent. Highlights, progress, the wordmark dot |
| `leaf` | Done and positive only. A green that is not "done" is a bug. |
| `sky` · `clay` · `honey` | Category hues. Assigned to a folder or program, never to a state. |

**Semantics are not decoration.** `leaf` means complete, `zest` means "this is the thing", `clay`
means destructive or overdue. Picking `sky` because a card looked nice in blue is how a palette
stops meaning anything the moment the user changes it.

### Transparency

Always `alpha(colors.x, 0.7)`, never a literal `rgba()`. A hand-written `rgba(20, 16, 12, 0.35)`
is a colour frozen at the factory default: it will not follow the user's palette and it will not
invert in dark mode. `alpha()` is already used in 41 files; match them.

Pure white and pure black are almost never right. `#fff` on a warm-paper theme reads cold, and it
stays cold when the user goes to Charcoal. If you want "brighter than the surface", that is
`relight()`.

### Dark mode

Light and dark only, no system theme, light is the default. Every colour goes through a token, so
dark mode is automatic. A literal stays dark-on-dark and disappears.

---

## Type

Composed from `useType()`, never by naming a family directly.

| Fragment | Use |
|---|---|
| `type.sans` / `sansMedium` / `sansSemiBold` | Body, UI text, lists, inputs |
| `type.display` / `displayBlack` | Wordmark, space titles, big numbers |

Display is for when the text **is** the object, not for every heading. Eyebrows are uppercase,
tracked, `inkMuted`, via `<Eyebrow>`.

The user picks the two families in the Style page. Roles stay fixed; families do not.

---

## Shape and elevation

### Radius

`useCardRadius()`. One number, set by the user's slider, used by every card. A literal
`borderRadius: 24` on a panel is a card that ignores their choice. Small inner controls (chips,
inputs) can use a fixed smaller radius; anything card-shaped uses the hook.

### Elevation

`useElevation()` from `@/stores/theme`. Two levels, and there is no third:

| Level | Meaning |
|---|---|
| `rest` | Sitting on the page. Nearly everything. |
| `lifted` | The finger is holding it. Drag, reorder, the live block. |

It returns the whole shadow style, scaled by the user's shadow slider and tinted from their `ink`.
Writing `shadowColor` by hand is the single most common ownership violation in the app; see
[design-audit.md](design-audit.md) finding 1.

Depth comes from soft light, never bevels or gloss.

---

## Motion

**Motion has to do a job.** There are exactly three, and anything doing none of them does not animate.

1. **Follow the finger.** Drag, swipe, scroll. The user is physically moving something, so it needs
   physics to stay attached to them. **This is the only place a spring belongs.**
2. **Explain a change.** Something appeared, moved, or left, and without the motion the user would
   have to re-find it. A short timing curve, nothing more.
3. **Confirm an action.** The press dip, the tick. Small, immediate, over.

What is deliberately not on that list: decorative bounce, staggered entrances for their own sake,
anything that overshoots because overshoot is fun, and motion added to a screen because the screen
felt static. A notebook does not wobble when you write in it.

The bar to clear is not "is this delightful", it is **"what would the user lose if this were
instant?"** If the honest answer is nothing, make it instant. Most of the app should be.

Everything below is in [`mobile/src/lib/motion.ts`](../mobile/src/lib/motion.ts).

### No wobble

Every spring in the app is near-critically damped. The test is objective:

```
ratio = damping / (2 * sqrt(stiffness * mass))
```

At 1.0 a value arrives and stops dead. Below about 0.8 it visibly bounces. **The system requires
0.8 or above**, and `design-check.sh` computes it and fails anything under. A checkbox tick at
`stiffness: 520, damping: 18` is a ratio of 0.39, which is a spring pretending to be a toy.

If you want overshoot, you need a reason the gesture itself implies it. "It feels nice" is not one.

### Durations

Milliseconds. The ceiling for a transition is **220**: past that it stops reading as a consequence of
what you did and starts reading as the app being slow.

| Token | Value | Use |
|---|---|---|
| `dur.instant` | 110 | Confirmation. Press dip, tick, toggle. |
| `dur.quick` | 160 | **The default.** Fades, colour, small moves. |
| `dur.moved` | 220 | Something actually travelled: a sheet, a reveal. |

### Easings

| Token | Use |
|---|---|
| `ease.out` | **The default.** Arriving, settling into place. |
| `ease.in` | Leaving. It is going away, so it can hurry. |
| `ease.inOut` | Travelling between two places you can both see. |

Never linear. Nothing physical moves at constant speed and then stops.

`timing()` builds the config: `withTiming(1, timing())` for the default, or
`withTiming(1, timing(dur.moved, ease.inOut))`.

### Springs

Four, all attached to a finger, all named for what the hand is doing. **If no gesture is driving the
value, you want `timing()`.**

| Token | Ratio | Use |
|---|---|---|
| `gesture.press` | 0.98 | The press dip |
| `gesture.release` | 0.98 | Coming back up |
| `gesture.snap` | 0.89 | Released into a resting position: a dragged block landing on its slot |
| `gesture.track` | 0.83 | Tracking a swipe out and back: a row revealing an action behind it |

`<PressableScale>` already applies `press` and `release`. Use it rather than rebuilding a press state.

### Ambient loops

A "this is still running" pulse is not a transition and the 220ms ceiling does not apply: it has to
be slow enough to read as breathing rather than blinking. `ambient.breath` (1100ms, sine in-out) is
the one place a long duration is correct. Keep it to states that genuinely persist, such as a live
workout, and never more than one on screen.

### Reduced motion

Every config in `motion.ts` carries `ReduceMotion.System`, so animations resolve instantly to their
end value when the OS setting is on. Mount `<ReducedMotionConfig mode={ReduceMotion.System} />` once
at the app root for layout animations too.

Do not branch on `useReducedMotion()` in a component.

---

## Primitives

Check `mobile/src/components/` before building anything.

| Component | Gives you |
|---|---|
| `<Panel>` | The card: user radius, surface, rule border, grain, rest elevation |
| `<PressableScale>` | The press state. The only correct one. |
| `<Sheet>` | The modal surface |
| `<Check>` | The tactile checkbox |
| `<Eyebrow>` / `<Stamp>` | Micro-label, rubber-stamp badge |
| `<Grain>` / `<StampEdge>` / `<Plate>` | Paper texture, perforated edge, plate surface |

Feature-specific UI lives in `mobile/src/features/<feature>/components/`. If two features reach for
the same thing, it moves to `mobile/src/components/` or `mobile/src/lib/`.

---

## Adding to the system

1. **Look first.** A token or primitive probably covers it.
2. **Two uses make a token.** The second time a value is typed by hand, move it to its owner.
3. **Ask whose decision it is.** If the user would plausibly want it different, it belongs in the
   Style page, not in your component.
4. **A new colour needs a role, not a look.** And it needs adding to `tokens.ts` for both modes, or
   the Style page cannot reach it.
5. **A new spring needs a gesture.** If nothing is being dragged or swiped, use a timing curve.
6. **Document it here in the same change.** An undocumented token gets reinvented.

## Checking your work

- [ ] No hex, `rgba()`, or `shadowColor` literal. Colour comes from `usePalette()` and `alpha()`.
- [ ] Cards use `useCardRadius()` and `useElevation()`.
- [ ] Every spring is from `gesture.*` and driven by an actual gesture.
- [ ] Every non-gesture animation uses `timing()` and lands within 220ms.
- [ ] Nothing animates that could not answer "what would the user lose if this were instant?"
- [ ] `<PressableScale>` for presses, `<Panel>` for cards, `<Eyebrow>` for micro-labels.
- [ ] **Open the Style page and change the palette, the radius, and the shadow slider.** Anything
      that does not move is holding a value that belongs to the user.
- [ ] Checked in light and dark, and with reduced motion on.
- [ ] `npm run typecheck` and `npm run lint` pass.

`/design-check` runs this against your diff.
