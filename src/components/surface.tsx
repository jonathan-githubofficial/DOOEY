import { cn } from "@/lib/cn";

/** The skeuomorphic building block: a soft, rounded, grained, gently-shadowed card.
 * A hairline top highlight sells the "sheet of paper" edge. */
export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grain relative rounded-[var(--radius-card)] border border-rule/70 bg-surface p-6 shadow-soft md:p-7",
        "before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:rounded-full before:bg-white/50 dark:before:bg-white/10",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** A button shaped like a postage stamp — perforated edges, grained fill, follows-shape shadow. */
export function StampButton({
  className,
  children,
  accent = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { accent?: boolean }) {
  return (
    <button
      className={cn(
        "stamp-edge stamp-btn grain relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-[filter,transform] active:scale-95",
        accent ? "bg-zest text-paper" : "bg-surface text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A rubber-stamp badge — rotated, tracked, semi-inked. Give it colour via className. */
export function Stamp({
  children,
  className,
  rotate = -3,
}: {
  children: React.ReactNode;
  className?: string;
  rotate?: number;
}) {
  return (
    <span
      style={{ transform: `rotate(${rotate}deg)` }}
      className={cn(
        "grain inline-flex select-none items-center rounded-md border-[1.5px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] opacity-90",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Uppercase, tracked micro-label used inside cards. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("block text-[10px] uppercase tracking-[0.18em] text-ink-muted", className)}>
      {children}
    </span>
  );
}
