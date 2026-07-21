// Shared press-depress helper (unit 4.3 owns it). Main-Thread Scripting: each export is a
// `'main thread'` worklet (first statement is the directive) so a touch depresses the element
// on the MAIN thread, before the background React thread hears anything - the tactile "press in,
// release out" the design language calls for (docs: https://lynxjs.org/react/main-thread-script;
// crib "Main-Thread Scripting").
//
// Wiring: bind with `main-thread:bindtouchstart={pressDown}` + `main-thread:bindtouchend={pressUp}`
// (and `main-thread:bindtouchcancel={pressUp}`) on any tappable <view>; the element's own
// background-thread `bindtap` still carries the action. A component that wants a scale other than
// the default sets `data-press-scale` on the element (a serializable attribute the worklet reads
// off `e.currentTarget` - NOT a closure capture, per the MTS constraints below).
//
// MTS constraints obeyed (from the doc): the directive is the first statement; nothing from the
// outer scope is captured (would need to be JSON-serializable); no nested function defs; no
// outer-scope mutation (cross-call state would need useMainThreadRef); worklets run only after
// TTI, so these never touch first paint. The Phase-0 spike (finding 6) proved
// `main-thread:bindtouch*` worklets receive Playwright-synthesized touch on the web target, but
// note the committed L4 e2e config drives Desktop Chrome WITHOUT that touch recipe, so this
// press feel is exercised on-device / in the 5.2 gesture pass, not asserted at the L4 gate. The
// sibling <Check> (4.2) and StampButton/Slider (L2) ship the equivalent CSS `active:scale-*`
// press on the web target for parity; this worklet is the shared MTS form they and 4.1's
// TaskComposer bind where the tactile main-thread depress is wanted.
import type { MainThread } from "@lynx-js/types";

/** Depress on touch-start: scale the pressed element in (default 0.92, or `data-press-scale`). */
export function pressDown(e: MainThread.TouchEvent) {
  "main thread";
  const scale = e.currentTarget.getAttribute("data-press-scale") || "0.92";
  e.currentTarget.setStyleProperty("transform", `scale(${scale})`);
}

/** Release on touch-end / touch-cancel: settle the element back to rest. */
export function pressUp(e: MainThread.TouchEvent) {
  "main thread";
  e.currentTarget.setStyleProperty("transform", "scale(1)");
}
