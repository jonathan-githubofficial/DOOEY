# Token Reference

Lookup tables only, for `mobile/`. The reasoning and the rules live in
[docs/design-system.md](../../../docs/design-system.md).

## Ownership map

Every row is a value the user controls from the Style page. Reach for the left column, never the right.

| Need | Use | From | Never |
|---|---|---|---|
| Colour | `usePalette()` | `@/stores/theme` | a hex literal |
| Transparency | `alpha(colors.x, 0.35)` | `@/lib/theme` | `rgba(20, 16, 12, 0.35)` |
| Brighter than surface | `relight()` | `@/lib/theme` | `"#fff"` |
| Typography | `useType()` | `@/stores/theme` | naming a font family |
| Card corners | `useCardRadius()` | `@/features/style/store` | `borderRadius: 24` |
| Shadow | `useElevation("rest" \| "lifted")` | `@/stores/theme` | `shadowColor:` by hand |
| Shadow multiplier only | `useShadow()` | `@/features/style/store` | |

Exempt: `features/workouts/anatomy.ts` (illustration data, not chrome).

## Palette

`usePalette()` returns these ten. All user-overridable per mode.

| Token | Role |
|---|---|
| `paper` | Page background |
| `surface` | Cards and panels |
| `ink` | Primary text, and the tint every shadow derives from |
| `inkMuted` | Secondary text, eyebrows, captions |
| `rule` | Borders. Panels use `alpha(colors.rule, 0.7)` |
| `zest` | Accent, highlights, progress |
| `leaf` | Done and positive only |
| `sky` `clay` `honey` | Category hues, never states |

Light and dark only. No system theme. Light is the default.

## Typography

`useType()` returns: `sans`, `sansMedium`, `sansSemiBold`, `display`, `displayBlack`.

Display is for when the text **is** the object (wordmark, space titles, big numbers), not for every
heading. Eyebrows via `<Eyebrow>`.

## Elevation

`useElevation(level)`. Two levels, no third.

| Level | Meaning |
|---|---|
| `rest` | Sitting on the page. Nearly everything. |
| `lifted` | The finger is holding it. Drag, reorder, live block. |

Returns the complete shadow style, tinted from `ink` and scaled by the user's slider.

## Motion

`import { dur, ease, timing, gesture, ambient } from "@/lib/motion"`

### The rule

Motion does one of three jobs or it does not happen: **follow the finger**, **explain a change**,
**confirm an action**. Before adding any animation: *what would the user lose if this were instant?*

Springs only for the first. Everything else is `timing()`.

### Durations (ms)

| Token | Value | Use |
|---|---|---|
| `dur.instant` | 110 | Press dip, tick, toggle |
| `dur.quick` | 160 | **Default.** Fades, colour, small moves |
| `dur.moved` | 220 | **The ceiling.** A sheet, a reveal |

### Easings

| Token | Use |
|---|---|
| `ease.out` | **Default.** Arriving, settling |
| `ease.in` | Leaving |
| `ease.inOut` | Travelling between two visible places |

Never linear.

```ts
withTiming(1, timing())                        // 160ms, ease.out
withTiming(1, timing(dur.moved, ease.inOut))
```

### Springs

Four, all attached to a finger. Damping ratio must be **>= 0.8**:
`damping / (2 * sqrt(stiffness * mass))`.

| Token | Config | Ratio | Use |
|---|---|---|---|
| `gesture.press` | 700 / 52 | 0.98 | The press dip |
| `gesture.release` | 550 / 46 | 0.98 | Coming back up |
| `gesture.snap` | 500 / 40 | 0.89 | Released into a resting position |
| `gesture.track` | 420 / 34 | 0.83 | Swipe tracking out and back |

`<PressableScale>` already applies `press` and `release`.

### Ambient

`ambient.breath` (1100ms, sine in-out) for a persistent "still running" indicator. The one exception
to the 220ms ceiling. Never more than one on screen.

### Reduced motion

Every config carries `ReduceMotion.System`. Mount `<ReducedMotionConfig mode={ReduceMotion.System} />`
once at the app root. Never branch on `useReducedMotion()` in a component.

## Primitives

`mobile/src/components/`

| Component | Gives you |
|---|---|
| `<Panel>` | The card: user radius, surface, rule border, grain, rest elevation |
| `<PressableScale>` | The press state. The only correct one. |
| `<Sheet>` | Modal surface |
| `<Check>` | Tactile checkbox |
| `<Eyebrow>` / `<Stamp>` | Micro-label, rubber-stamp badge |
| `<Grain>` / `<StampEdge>` / `<Plate>` | Paper texture, perforated edge, plate surface |
| `<Dock>` / `<Masthead>` / `<DoodleSvg>` | Web dock island, header, doodle renderer |
