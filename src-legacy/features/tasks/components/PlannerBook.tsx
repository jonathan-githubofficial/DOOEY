import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useIsPresent } from "motion/react";

/** Binding geometry — rings and the sheet's punched holes must agree, so both
 * layers use these: same slot count, same gutter, same slot width. Hole centers
 * sit 14px below the sheet's top edge; the wire ends 2px past that, inside the
 * hole. */
export const RING_COUNT = 3;
export const BINDING_ROW = "absolute inset-x-0 flex justify-between px-[16%]";
export const BINDING_SLOT = "flex w-3 justify-center";

/** The top-bound planner pad: static wire rings, pages that flip up over the
 * binding (desk-calendar style), and the rest of the pad peeking out below.
 * Forward reveals the next page beneath the flipping one; back flips the
 * previous page down from over the top. */
export function PlannerBook({
  page,
  direction,
  children,
}: {
  page: string;
  direction: number;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // Pages differ in height; the pad glides between them instead of snapping.
  const [height, setHeight] = useState<number | null>(null);

  const variants = reduceMotion
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.2 } },
      }
    : {
        // Forward: the top page peels up and over the rings (accelerating like a
        // released flap, darkening as it tilts away from the light), revealing the
        // next page beneath it, which sits in the pad's shadow until uncovered.
        // Back: the previous page flaps down from over the top and lands with a
        // small paper settle (spring), while the covered page dims underneath.
        enter: (dir: number) =>
          dir > 0
            ? { rotateX: 0, scale: 0.988, opacity: 1, zIndex: 1, filter: "brightness(0.93)" }
            : { rotateX: 140, opacity: 1, zIndex: 4, filter: "brightness(0.82)" },
        center: (dir: number) =>
          dir > 0
            ? {
                rotateX: 0,
                scale: 1,
                opacity: 1,
                zIndex: 2,
                filter: "brightness(1)",
                // The shadow of the departing page passes first, then this one brightens.
                transition: { duration: 0.42, ease: [0.3, 0.5, 0.3, 1] as const },
              }
            : {
                rotateX: 0,
                scale: 1,
                opacity: 1,
                zIndex: 4,
                filter: "brightness(1)",
                transition: {
                  rotateX: { type: "spring", stiffness: 260, damping: 22, mass: 0.9 },
                  filter: { duration: 0.28, ease: "easeOut" as const },
                },
              },
        exit: (dir: number) =>
          dir > 0
            ? {
                rotateX: 140,
                opacity: [1, 1, 0],
                filter: ["brightness(1)", "brightness(0.88)", "brightness(0.8)"],
                zIndex: 4,
                transition: {
                  duration: 0.42,
                  ease: [0.5, 0.05, 0.75, 0.55] as const,
                  opacity: { times: [0, 0.85, 1] },
                  filter: { times: [0, 0.5, 1] },
                },
              }
            : {
                rotateX: 0,
                scale: 0.988,
                opacity: 0,
                zIndex: 1,
                filter: "brightness(0.93)",
                transition: { duration: 0.34, ease: "easeOut" as const },
              },
      };

  return (
    <motion.div
      className="relative"
      style={{ perspective: "1400px" }}
      animate={height != null ? { height } : undefined}
      // Tween, not spring: the pad resizing must never bounce — it reads as glitch.
      transition={{ duration: 0.32, ease: [0.3, 0.6, 0.3, 1] }}
    >
      <Rings />
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={page}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          className="relative origin-top will-change-transform"
        >
          <MeasuredPage onHeight={setHeight}>{children}</MeasuredPage>
        </motion.div>
      </AnimatePresence>
      {/* The rest of the pad, peeking out under the top page. Static on purpose:
          it's the part of the pad you're NOT flipping, so it must not move. */}
      <div
        aria-hidden
        className="absolute inset-x-2 -bottom-[5px] -z-10 h-4 rounded-b-[var(--radius-card)] border border-rule/60 bg-surface/90 shadow-soft"
      />
      <div
        aria-hidden
        className="absolute inset-x-5 -bottom-[10px] -z-20 h-4 rounded-b-[var(--radius-card)] border border-rule/50 bg-surface/70"
      />
    </motion.div>
  );
}

/** Reports the current (non-exiting) page's height so the pad can glide to it.
 * Exiting pages keep quiet — only the arriving page decides the pad's size.
 * useIsPresent (read-only!) — usePresence would switch AnimatePresence into
 * manual-removal mode and exiting pages would never unmount. */
function MeasuredPage({
  onHeight,
  children,
}: {
  onHeight: (h: number) => void;
  children: React.ReactNode;
}) {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!isPresent || !el) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPresent, onHeight]);

  return <div ref={ref}>{children}</div>;
}

/** The binder wire: three slim metal loops that dive into the page's punched
 * holes. They belong to the binder, so they sit above every flipping page. */
function Rings() {
  return (
    <div aria-hidden className={`${BINDING_ROW} pointer-events-none -top-5 z-20`}>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <span key={i} className={BINDING_SLOT}>
          <span className="h-9 w-[7px] rounded-full border border-ink/40 bg-gradient-to-b from-white via-ink/5 to-ink/30 shadow-[0_1px_2px_rgb(40_32_24/0.3)] dark:border-white/30 dark:from-white/40 dark:via-white/10 dark:to-black/40" />
        </span>
      ))}
    </div>
  );
}
