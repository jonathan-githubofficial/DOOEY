import { DoodleSvg } from "@/components/doodle-svg";
import { useStyleStore } from "../store";

/** The hand-drawn mark a page wears next to its title — drawn in the Style
 * studio. Renders nothing until one exists. */
export function PageDoodle({ page }: { page: string }) {
  const strokes = useStyleStore((s) => s.pageDoodles[page]);
  if (!strokes?.length) return null;
  return (
    <span aria-hidden className="relative block h-11 w-11 shrink-0">
      <DoodleSvg strokes={strokes} strokeWidth={2} relative />
    </span>
  );
}
