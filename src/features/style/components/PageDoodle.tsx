import { DoodleSvg } from "@/components/doodle-svg";
import { useStyleStore } from "../store";

/** The hand-drawn mark a page wears next to its title - drawn on Boards (the DoodleEditor is
 * deferred to unit 7.3). Renders nothing until one exists. Read-only (unit 3.4, ported from
 * src-legacy/features/style/components/PageDoodle.tsx). Crib "Elements": the old <span> wrapper
 * becomes a <view>; DoodleSvg (unit 3.3) is the read-only renderer. */
export function PageDoodle({ page }: { page: string }) {
  const strokes = useStyleStore((s) => s.pageDoodles[page]);
  if (!strokes?.length) return null;
  return (
    <view aria-hidden className="relative block h-11 w-11 shrink-0">
      <DoodleSvg strokes={strokes} strokeWidth={2} relative />
    </view>
  );
}
