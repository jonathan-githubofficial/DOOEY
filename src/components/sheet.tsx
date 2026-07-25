import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, useDragControls } from "motion/react";
import { cn } from "@/lib/cn";
import { dialog, fade, sheet, spring } from "@/lib/motion";

/** Everything a modal surface owes the user, in one place: a scrim you can
 * click away, Escape to dismiss, focus moved in and returned on close, Tab
 * kept inside, the page behind held still, and a portal so no ancestor's
 * `overflow` or `transform` can clip it.
 *
 * Hand-rolling this is how the app ended up with five overlays that each
 * handled a different subset. Two presentations:
 *
 * - `bottom`: the drawer. Hinged on the bottom edge, flick the handle to dismiss.
 * - `center`: the dialog. Lands in the middle of the viewport.
 *
 * Mount inside <AnimatePresence> and unmount to close, so the exit runs:
 *
 * ```tsx
 * <AnimatePresence>
 *   {open && <Sheet label="New task" onClose={close}>…</Sheet>}
 * </AnimatePresence>
 * ```
 */
export function Sheet({
  label,
  onClose,
  side = "bottom",
  className,
  children,
}: {
  /** Names the dialog for screen readers. Required: an unlabelled dialog is a trap. */
  label: string;
  onClose: () => void;
  side?: "bottom" | "center";
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const controls = useDragControls();

  // Escape closes, Tab cycles within the panel, and focus returns to whatever
  // opened the sheet once it's gone.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  // Hold the page still behind the sheet, without the layout shift that
  // removing the scrollbar would cause.
  useEffect(() => {
    const { body } = document;
    const previous = body.style.overflow;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = previous;
      body.style.paddingRight = "";
    };
  }, []);

  const bottom = side === "bottom";

  // A centred panel is positioned by a flex wrapper rather than a translate,
  // so nothing competes with motion for the `transform` property. The wrapper
  // ignores pointer events so the scrim underneath stays clickable.
  const wrap = (node: React.ReactNode) =>
    bottom ? (
      node
    ) : (
      <div className="pointer-events-none fixed inset-0 z-overlay grid place-items-center p-4">
        {node}
      </div>
    );

  return createPortal(
    <>
      <motion.button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        variants={fade}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-scrim bg-scrim"
      />
      {wrap(
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        variants={bottom ? sheet : dialog}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={spring.glide}
        {...(bottom
          ? {
              drag: "y" as const,
              dragListener: false,
              dragControls: controls,
              dragConstraints: { top: 0 },
              dragElastic: { top: 0, bottom: 0.5 },
              dragSnapToOrigin: true,
              onDragEnd: (_e: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
                if (info.offset.y > 80 || info.velocity.y > 500) onClose();
              },
            }
          : {})}
        className={cn(
          "grain border border-rule/70 bg-surface shadow-soft outline-none",
          bottom
            ? "fixed inset-x-0 bottom-0 z-overlay mx-auto max-w-xl rounded-t-card border-b-0 px-5 pb-8 pt-3"
            : "pointer-events-auto w-full max-w-md rounded-card p-6",
          className,
        )}
      >
        {bottom && (
          <div
            onPointerDown={(e) => controls.start(e)}
            style={{ touchAction: "none" }}
            className="-mx-5 flex cursor-grab justify-center pb-3 pt-1 active:cursor-grabbing"
            aria-hidden
          >
            <span className="h-1 w-10 rounded-full bg-ink/15" />
          </div>
        )}
        {children}
      </motion.div>,
      )}
    </>,
    document.body,
  );
}
