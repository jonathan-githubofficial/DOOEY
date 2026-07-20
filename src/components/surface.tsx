// Tactile primitives (unit 2.3, ported from src-legacy/components/surface.tsx).
// Lynx has no <button>/<span>/::before - interactive containers are <view bindtap={...}>,
// inline text wrappers are <view>/<text>, and the old before:-pseudo-element hairline
// highlight becomes a real child <view> (https://lynxjs.org/api/css/selectors.html - no
// pseudo-element support at all). <text> does not inherit CSS, so colour/font stay directly
// on every <text> (crib sheet).
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { GrainOverlay } from "@/components/grain-overlay";

/** A bare string/number child renders as a `<raw-text>` directly inside a `<view>`, which
 * collapses to a 0x0 box on the Lynx web target (only a `<text>` lays out as a flex child),
 * so the label is invisible - the empty "JUL 20" stamp oval and the label-less sign-out
 * stamp were exactly this. Wrap primitive children in a `<text>`; pass element children
 * (icons, or a consumer's own `<text>`) through untouched. Colour + font cascade to the
 * wrapping `<text>` from the primitive's own classes. */
function labelChildren(children: ReactNode): ReactNode {
  const wrap = (c: string | number, key?: number) => (
    <text key={key} className="text-inherit">
      {c}
    </text>
  );
  if (typeof children === "string" || typeof children === "number") return wrap(children);
  if (Array.isArray(children)) {
    return children.map((c, i) => (typeof c === "string" || typeof c === "number" ? wrap(c, i) : c));
  }
  return children;
}

/** The skeuomorphic building block: a soft, rounded, grained, gently-shadowed card.
 * A hairline top highlight sells the "sheet of paper" edge. */
export function Panel({
  className,
  children,
  ...rest
}: { className?: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <view
      className={cn(
        "relative rounded-[var(--radius-card)] border border-rule/70 bg-surface p-6 shadow-soft md:p-7",
        className,
      )}
      {...rest}
    >
      <GrainOverlay className="absolute inset-0 rounded-[var(--radius-card)]" />
      {/* Real child element replacing the old before: hairline-highlight pseudo-element -
          Lynx has no ::before/::after (https://lynxjs.org/api/css/selectors.html). */}
      <view
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-full bg-white/50 dark:bg-white/10"
      />
      {children}
    </view>
  );
}

/** Uppercase, tracked micro-label used inside cards. */
export function Eyebrow({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <text className={cn("block text-[10px] uppercase tracking-[0.18em] text-ink-muted", className)}>
      {children}
    </text>
  );
}

/** A button shaped like a postage stamp - perforated edges, grained fill,
 * follows-shape shadow. */
export function StampButton({
  className,
  children,
  accent = false,
  disabled,
  onClick,
  ...rest
}: {
  className?: string;
  children?: ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick?: (e: unknown) => void;
} & Record<string, unknown>) {
  return (
    <view
      bindtap={disabled ? undefined : onClick}
      user-interaction-enabled={!disabled}
      className={cn(
        "stamp-edge stamp-btn relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium font-sans active:scale-95",
        accent ? "bg-zest text-paper" : "bg-surface text-ink",
        disabled && "opacity-50",
        className,
      )}
      {...rest}
    >
      <GrainOverlay className="absolute inset-0" />
      {labelChildren(children)}
    </view>
  );
}

/** A rubber-stamp badge - rotated, tracked, semi-inked. Give it colour via className. */
export function Stamp({
  children,
  className,
  rotate = -3,
}: {
  children?: ReactNode;
  className?: string;
  rotate?: number;
}) {
  return (
    <view
      aria-hidden={false}
      style={{ transform: `rotate(${rotate}deg)` }}
      className={cn(
        "relative inline-flex select-none items-center rounded-md border-[1.5px] px-2 py-0.5 text-[9px] font-bold font-sans uppercase tracking-[0.2em] opacity-90",
        className,
      )}
    >
      <GrainOverlay className="absolute inset-0 rounded-md" />
      {labelChildren(children)}
    </view>
  );
}
