// The top-bound planner pad (unit 4.1, ported from src-legacy/features/tasks/components/
// PlannerBook.tsx onto Lynx): static wire rings, a page that flips up over the binding
// (desk-calendar style), and the rest of the pad peeking out below. Forward reveals the next
// page beneath the flipping one; back flaps the previous page down from over the top.
//
// The three shared layout constants (RING_COUNT / BINDING_ROW / BINDING_SLOT) were shipped ahead
// of this component by unit 4.3 (land order R4: 4.2 -> 4.3 -> 4.1) so its AgendaSheet/TimeboxSheet
// could align their punched holes to the rings; they are KEPT here (BROOM) - AgendaSheet imports
// them from this module.
//
// DROPPED (recorded BROOM): `motion`/`AnimatePresence`/`useReducedMotion`/`useIsPresent` (framer)
// -> the `variants` object is re-expressed as the direction-aware CSS keyframes in
// styles/global.css (dooey-flip-*), and presence is tracked by hand: Lynx has no AnimatePresence,
// so the arriving page mounts with an enter class while the departing page stays mounted with an
// exit class until its `bindanimationend` fires (SPEC 4b). `ResizeObserver`/`MeasuredPage` height
// glide -> DROPPED (Lynx web has no verified ResizeObserver, SPEC 4d): the pad sizes to the
// arriving page's content (the arriving layer is in normal flow, the departing layer is absolute
// so it never fights layout); a small non-glide when pages differ in height is accepted (60fps
// polish is PARKED). Reduced-motion (SPEC 4e) swaps the flip for a plain opacity cross-fade, gated
// on the stores/theme `useReducedMotion` pref (R11: no OS signal on the web worker).
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useReducedMotion } from "@/stores";

/** Binding geometry - rings and the sheet's punched holes must agree, so both layers use these:
 * same slot count, same gutter, same slot width. Hole centers sit just below the sheet's top edge.
 * KEPT for unit 4.3's AgendaSheet/TimeboxSheet (BROOM). */
export const RING_COUNT = 3;
export const BINDING_ROW = "absolute inset-x-0 flex justify-between px-[16%]";
export const BINDING_SLOT = "flex w-3 justify-center";

/** A page currently animating out (the desk-calendar equivalent of framer's exiting element). We
 * snapshot its `children` because `children` always reflects the CURRENT day - the departing page
 * must keep showing the day it is flipping away from. */
interface Departing {
  page: string;
  dir: number;
  children: ReactNode;
}

export function PlannerBook({
  page,
  direction,
  children,
}: {
  page: string;
  direction: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  // Presence tracking by hand (no AnimatePresence). `departing` holds the page flipping out; it is
  // set when `page` changes and cleared when the exit animation ends (bindanimationend). Refs carry
  // the last-committed page + children so the effect can capture the OUTGOING day's content.
  const [departing, setDeparting] = useState<Departing | null>(null);
  const pageRef = useRef(page);
  const childrenRef = useRef<ReactNode>(children);

  useEffect(() => {
    if (pageRef.current !== page) {
      setDeparting({ page: pageRef.current, dir: direction, children: childrenRef.current });
      pageRef.current = page;
    }
    childrenRef.current = children;
  }, [page, direction, children]);

  // Removal is driven by the departing page's bindanimationend; a duration-matched timeout is the
  // web-target fallback (guarded to this instance so a fresh flip is never wiped) - the same
  // belt-and-braces cleanup ComposerSheet uses, since web-target animationend can be flaky.
  useEffect(() => {
    if (!departing) return;
    const t = setTimeout(() => setDeparting((d) => (d === departing ? null : d)), 460);
    return () => clearTimeout(t);
  }, [departing]);

  // A flip is in flight while a departing page exists; the arriving page only animates then (a
  // first mount / settled pad shows no entrance, matching framer's `initial={false}`).
  const flipping = departing != null;
  const forward = (departing?.dir ?? direction) > 0;

  const arrivingAnim = !flipping
    ? ""
    : reduced
      ? "animate-enter-fade"
      : forward
        ? "animate-flip-in-fwd"
        : "animate-flip-in-back";
  const departingAnim = reduced
    ? "animate-exit-fade"
    : forward
      ? "animate-flip-out-fwd"
      : "animate-flip-out-back";

  // Forward: the departing page peels up OVER the arriving one; Back: the arriving page flaps down
  // over the departing one. z-index expresses which sits on top during the flip.
  const arrivingZ = forward ? 1 : 4;
  const departingZ = forward ? 4 : 1;

  return (
    <view className="relative" style={{ perspective: "1400px" }}>
      <Rings />

      {/* The departing page: absolutely positioned so it never pushes the pad's height (the
          arriving page below owns the layout, SPEC 4d). Unmounts on its exit animation end. */}
      {departing && (
        <view
          key={departing.page}
          bindanimationend={() => setDeparting(null)}
          style={{ transformOrigin: "top", zIndex: departingZ }}
          className={`absolute inset-x-0 top-0 origin-top will-change-transform ${departingAnim}`}
        >
          {departing.children}
        </view>
      )}

      {/* The arriving (current) page: keyed by `page` so React remounts it on a day change and the
          enter animation replays. In normal flow, so the pad sizes to its content. */}
      <view
        key={page}
        style={{ transformOrigin: "top", zIndex: arrivingZ }}
        className={`relative origin-top will-change-transform ${arrivingAnim}`}
      >
        {children}
      </view>

      {/* The rest of the pad, peeking out under the top page. Static on purpose: it is the part of
          the pad you are NOT flipping, so it must not move (ports of the two under-pad layers). */}
      <view
        accessibility-element={false}
        className="absolute inset-x-2 -bottom-[5px] -z-10 h-4 rounded-b-[var(--radius-card)] border border-rule/60 bg-surface/90 shadow-soft"
      />
      <view
        accessibility-element={false}
        className="absolute inset-x-5 -bottom-[10px] -z-20 h-4 rounded-b-[var(--radius-card)] border border-rule/50 bg-surface/70"
      />
    </view>
  );
}

/** The binder wire: three slim metal loops that dive into the page's punched holes. They belong to
 * the binder, so they sit above every flipping page (z-20). */
function Rings() {
  return (
    <view
      accessibility-element={false}
      className={`${BINDING_ROW} pointer-events-none -top-5 z-20`}
    >
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <view key={i} className={BINDING_SLOT}>
          <view className="h-9 w-[7px] rounded-full border border-ink/40 bg-gradient-to-b from-white via-ink/5 to-ink/30 shadow-[0_1px_2px_rgb(40_32_24/0.3)] dark:border-white/30 dark:from-white/40 dark:via-white/10 dark:to-black/40" />
        </view>
      ))}
    </view>
  );
}
