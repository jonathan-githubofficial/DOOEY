import type { ReactNode } from "react";

/** Slim page header (unit 3.3, ported from src-legacy/components/masthead.tsx): the doodled
 * avatar, a space title (a string gets display type; pass a node for richer headers), and
 * per-space actions on the right. The wordmark lives in the dock now.
 *
 * Element mapping (crib "Elements, not HTML"): <header>/<h1>/<div> -> <view>/<text>; the string
 * title becomes a <text> carrying its colour + display font explicitly (<text> does not inherit
 * CSS). `avatar` + `children` slots are rendered verbatim. */
export function Masthead({
  avatar,
  title,
  children,
}: {
  avatar?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <view className="relative flex items-center justify-between gap-4">
      <view className="flex min-w-0 items-center gap-3.5">
        {avatar}
        {typeof title === "string" ? (
          <text className="truncate font-display text-3xl font-black leading-none tracking-tight text-ink">
            {title}
          </text>
        ) : (
          title
        )}
      </view>
      <view className="flex items-center gap-3">{children}</view>
    </view>
  );
}
