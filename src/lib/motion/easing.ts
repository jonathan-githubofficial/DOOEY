// Shared "settle, don't snap" easing tokens (unit 4.3 owns them; 4.1/4.2 and the sheets here
// import from here instead of hard-coding cubic-beziers). CLAUDE.md motion law: interactions
// settle rather than snap, interactions <= 200ms, transitions <= 350ms. These are plain CSS
// timing-function strings for `transition-timing-function` / `animation-timing-function`
// (the Lynx crib sanctions CSS transitions/keyframes for enter/exit; MTS is only for
// gesture-linked motion).

/** Overshoot settle for enter / return-to-rest (a gentle past-the-mark bounce back). */
export const SETTLE = "cubic-bezier(0.34, 1.3, 0.4, 1)";

/** Accelerating exit for dismiss / peel-away (starts slow, races out). */
export const PEEL = "cubic-bezier(0.5, 0.05, 0.75, 0.55)";

/** Completion pop for the checkbox tick draw-on (a snappier overshoot than SETTLE). This is the
 * SAME curve unit 4.2's <Check> already hard-codes for its tick scale-in; keep them identical. */
export const TICK = "cubic-bezier(0.34, 1.56, 0.5, 1)";
