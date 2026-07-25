import type { Transition, Variants } from "motion/react";

/** DOOEY's motion vocabulary.
 *
 * Things settle, they don't snap. Every animation in the app picks from the
 * springs, durations, press states and variants below: if a component writes
 * its own `stiffness`/`damping` pair, two screens drift apart and nobody
 * notices until the app feels arbitrary.
 *
 * Reduced motion is handled once, globally, by <MotionConfig reducedMotion="user">
 * in main.tsx plus the media query in styles/global.css. Don't branch on
 * useReducedMotion() in a component unless the animation carries meaning that
 * a crossfade would destroy (a page turn, a direction cue).
 */

/* ------------------------------------------------------------------ springs */

/** `settle` is the default. Reach for another only when the object's mass or
 * personality genuinely differs: a checkbox is not a bottom sheet. */
export const spring = {
  /** Small controls that must feel instant: dock tabs, toggles, chips, checks. */
  snap: { type: "spring", stiffness: 500, damping: 34 },
  /** The default. Cards, list items, popovers, section reveals. */
  settle: { type: "spring", stiffness: 420, damping: 32 },
  /** Large surfaces with weight: bottom sheets, dialogs, full-page panels. */
  glide: { type: "spring", stiffness: 360, damping: 34 },
  /** Deliberate overshoot for playful objects: doodles, stamps, stickers,
   * a tick drawing itself on. Use sparingly; overshoot everywhere reads as noise. */
  bounce: { type: "spring", stiffness: 460, damping: 22 },
  /** Paper physics: the planner page turn. Heavy, slow to recover. */
  page: { type: "spring", stiffness: 260, damping: 24, mass: 0.9 },
} satisfies Record<string, Transition>;

/* ---------------------------------------------------------------- durations */

/** Tween durations, in seconds, for the cases a spring can't express
 * (crossfades, height collapses, colour washes). Budget from CLAUDE.md:
 * interactions land within 200ms, page transitions within 350ms. */
export const dur = {
  /** Crossfades and colour changes. Matches the CSS `transition` default. */
  fast: 0.18,
  /** Height/width collapses, staged reveals. */
  base: 0.24,
  /** The ceiling. Page-level transitions only. */
  slow: 0.34,
} as const;

/** The house easing: a decelerating curve that arrives soft. Never `linear`. */
export const ease = [0.32, 0.72, 0, 1] as const;

/** Shorthand for a tween, e.g. `transition={tween(dur.base)}`. */
export const tween = (duration: number = dur.fast): Transition => ({ duration, ease });

/* ------------------------------------------------------------------- press */

/** Press depth scales with the target: a 24px icon needs a visible squeeze,
 * a full-width card would look broken with the same one. Pair with
 * `whileTap={press.control}` in motion, or the CSS twin in the doc. */
export const press = {
  /** Icon buttons, dock tabs, anything roughly 24-40px. */
  icon: { scale: 0.92 },
  /** Standard buttons, chips, pills, day cells. */
  control: { scale: 0.96 },
  /** Large surfaces: task rows, cards, board objects. Barely there on purpose. */
  surface: { scale: 0.99 },
  /** The checkbox's signature deep press. Only `components/page/Check.tsx`. */
  check: { scale: 0.78 },
} as const;

/** Lift on hover, for objects that advertise they're grabbable or openable. */
export const hover = {
  /** Cards and folders rise toward the cursor. */
  raise: { y: -4 },
  /** Playful objects lean in. */
  tilt: { scale: 1.06, rotate: -2 },
} as const;

/* ---------------------------------------------------------------- variants */

/** Enter/exit pairs, all built for `<AnimatePresence>`. Pick by where the
 * thing comes from, not by what it is: content that arrives in place fades,
 * content that arrives from below rises, a menu hanging off a trigger drops. */

/** Pure crossfade. Scrims, backdrops, anything whose position is already right. */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** The workhorse: content arriving in a list or section, from just below. */
export const rise: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

/** Menus, dropdowns, and popovers hanging below their trigger. */
export const drop: Variants = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

/** Something appearing at a point rather than sliding in: badges, tooltips,
 * a newly placed board object. */
export const pop: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

/** A modal panel: rises and grows a touch as it lands. */
export const dialog: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.98 },
};

/** A bottom sheet, hinged on the bottom edge of the viewport. */
export const sheet: Variants = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
};

/** Disclosure: a section growing into the space it needs. Give the element
 * `overflow-hidden` or the content will spill during the tween. */
export const collapseY: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

/** The horizontal twin: a control widening into a toolbar slot. */
export const collapseX: Variants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

/** Paged content where the direction carries meaning (week-to-week, month-to-
 * month). Pass `custom={direction}` (1 forward, -1 back) on the motion element. */
export const slideX: Variants = {
  initial: (direction: number) => ({ opacity: 0, x: direction * 16 }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -16 }),
};

/* ---------------------------------------------------------------- stagger */

/** Cascade a list in. Put on the parent; children use a variant above.
 * Keep lists short: past ~8 items the tail arrives late enough to feel slow. */
export const stagger = (each = 0.04): Variants => ({
  animate: { transition: { staggerChildren: each } },
});
