import { cn } from "@/lib/cn";

/** Real element replacing the old ::after paper-grain trick (Lynx has no
 * pseudo-elements: https://lynxjs.org/api/css/selectors.html). Absolutely fills
 * whatever positioned ancestor renders it; pass `className` to size/position it
 * (e.g. "absolute inset-0" inside a Panel, or "fixed inset-0 -z-10" for the
 * whole-screen wash). */
export function GrainOverlay({ className }: { className?: string }) {
  return (
    <view aria-hidden className={cn("grain-tile pointer-events-none", className)} />
  );
}
