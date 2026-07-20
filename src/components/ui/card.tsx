// Ported from src-legacy/components/ui/card.tsx (unit 2.3). Structural wrappers become
// <view>; CardTitle becomes <text> (it renders text, unlike the structural <view>s) - the one
// real semantic fix versus a blind element swap, since Lynx has no heading-level element and
// <text> does not inherit CSS (crib sheet), so it carries its own classes. The old bare
// `font-display` (no weight class) now resolves to Fraunces-700 bold via unit 2.1's
// fonts.css mapping (no Fraunces-400 regular instance ships) - deliberate, matches
// CLAUDE.md's bold/black display-type language.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: { className?: string; children?: ReactNode } & Record<string, unknown>) {
  // `children` MUST be destructured and rendered as real JSX children, not left in the
  // `...props` spread: Lynx web-core's host <view> element tries to set a spread "children"
  // prop as a DOM attribute/property, and the browser's `Element.prototype.children` is a
  // read-only getter, so that throws ("Cannot set property children of #<Element> which has
  // only a getter") - verified against this build. Every structural wrapper below follows
  // the same rule (CardTitle already did).
  return (
    <view className={cn("rounded-2xl border border-rule bg-paper", className)} {...props}>
      {children}
    </view>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: { className?: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <view className={cn("flex flex-col gap-1.5 p-6 pb-3", className)} {...props}>
      {children}
    </view>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: { className?: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <text className={cn("font-display text-2xl tracking-tight text-ink", className)} {...props}>
      {children}
    </text>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: { className?: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <view className={cn("p-6 pt-0", className)} {...props}>
      {children}
    </view>
  );
}
