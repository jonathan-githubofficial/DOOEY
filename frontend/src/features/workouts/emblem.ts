import { useStyleStore } from "@/features/style/store";
import type { Stroke } from "@/lib/doodle";

/** The drawing a card wears when you haven't drawn it one: your gym page
 * doodle. A card is never blank — it just isn't bespoke yet. */
export function useEmblem(own: Stroke[]): Stroke[] {
  const fallback = useStyleStore((s) => s.pageDoodles.gym);
  return own.length > 0 ? own : (fallback ?? []);
}
