import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from "react-native-reanimated";

/** DOOEY's motion vocabulary.
 *
 * **Motion has to do a job.** There are exactly three, and anything that does
 * none of them does not animate:
 *
 * 1. **Follow the finger.** Drag, swipe, scroll. The user is physically moving
 *    something, so it needs physics to feel attached to them. This is the only
 *    place a spring belongs.
 * 2. **Explain a change.** Something appeared, moved, or left, and without the
 *    motion the user would have to re-find it. A short timing curve, nothing more.
 * 3. **Confirm an action.** The press dip, the tick. Small, immediate, over.
 *
 * What is deliberately not on that list: decorative bounce, staggered entrances
 * for their own sake, anything that overshoots because overshoot is fun. A
 * notebook does not wobble when you write in it. Motion here is quiet enough
 * that you would only notice it missing.
 *
 * **No wobble.** Every spring below is near-critically damped. The test is the
 * damping ratio:
 *
 *     ratio = damping / (2 * sqrt(stiffness * mass))
 *
 * At 1.0 the value arrives and stops dead. Below about 0.8 it visibly bounces.
 * Everything here sits at 0.8 or above, and the design checker fails anything
 * that does not. If you want a value to overshoot, you need a reason the
 * gesture itself implies it, not a preference.
 */

/* ---------------------------------------------------------------- durations */

/** Milliseconds. The ceiling is 220: past that a transition stops reading as a
 * consequence of what you did and starts reading as the app being slow. */
export const dur = {
  /** Confirmation. The press dip, a tick, a toggle. */
  instant: 110,
  /** **The default.** Fades, colour changes, small moves. */
  quick: 160,
  /** Something actually travelled: a sheet, a page's content, a reveal. */
  moved: 220,
} as const;

/* ------------------------------------------------------------------ easings */

/** Arrivals decelerate, departures accelerate, moves between two on-screen
 * positions do both. Never linear: nothing in the physical world moves at a
 * constant speed and then stops. */
export const ease = {
  /** **The default.** Something arriving or settling into place. */
  out: Easing.out(Easing.quad),
  /** Something leaving. It is going away, so it can hurry. */
  in: Easing.in(Easing.quad),
  /** Something travelling between two places you can both see. */
  inOut: Easing.inOut(Easing.quad),
} as const;

/** `withTiming(x, timing())` for the default, or `timing(dur.moved, ease.inOut)`. */
export const timing = (
  duration: number = dur.quick,
  easing: (t: number) => number = ease.out,
): WithTimingConfig => ({ duration, easing, reduceMotion: ReduceMotion.System });

/* ------------------------------------------------------------------ springs */

/** The only springs in the app, and every one of them is attached to a finger.
 * If no gesture is driving the value, you want `timing()` instead.
 *
 * Named for what the hand is doing, because that is what decides the feel. */
export const gesture = {
  /** The press dip. Effectively critical (ratio 0.98): a controlled squeeze
   * with no rebound. */
  press: { stiffness: 700, damping: 52, reduceMotion: ReduceMotion.System },
  /** Coming back up from a press. Also critical. */
  release: { stiffness: 550, damping: 46, reduceMotion: ReduceMotion.System },
  /** Released into a resting position: a dragged block landing on its slot,
   * a sheet returning to its detent. Ratio 0.89, so it arrives with weight and
   * without a bounce. */
  snap: { stiffness: 500, damping: 40, reduceMotion: ReduceMotion.System },
  /** Tracking a swipe out and back: the row that reveals an action behind it.
   * Ratio 0.83, the softest thing here, because the finger has already given
   * it momentum. */
  track: { stiffness: 420, damping: 34, reduceMotion: ReduceMotion.System },
} satisfies Record<string, WithSpringConfig>;

/* ------------------------------------------------------------------ ambient */

/** Looping indicators are not transitions and the 220ms ceiling does not apply
 * to them: a "this is still running" pulse has to be slow enough to read as
 * breathing rather than blinking. They are the one place a long duration is
 * correct. Keep them to states that genuinely persist (a live workout), and
 * never more than one on screen. */
export const ambient = {
  /** Half a breath. Pair with `withRepeat(..., -1, true)` for a full cycle. */
  breath: { duration: 1100, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System },
} satisfies Record<string, WithTimingConfig>;

/* ----------------------------------------------------------- reduced motion */

/** Every config above carries `ReduceMotion.System`, so animations resolve
 * instantly to their end value when the OS setting is on. Mount
 * `<ReducedMotionConfig mode={ReduceMotion.System} />` once at the app root to
 * cover layout animations and entering/exiting presets too.
 *
 * Do not branch on `useReducedMotion()` in a component. */
export { ReduceMotion } from "react-native-reanimated";
