import { useLiveWorkout } from "./api";
import { useLiveBar } from "./store";

/** The live bar's own geometry, shared by the bar and by every page that has
 * to scroll clear of it. */
export const BAR_H = 56;
export const PUCK_H = 40;
export const BAR_GAP = 10;

/** Extra bottom clearance a scrolling page needs while the bar floats over it,
 * and nothing at all when no session is open — otherwise the last row of a
 * page sits under the bar with no way to reach it. */
export function useLiveBarInset(): number {
  const workout = useLiveWorkout();
  const tucked = useLiveBar((s) => s.tucked);
  if (!workout) return 0;
  return (tucked ? PUCK_H : BAR_H) + BAR_GAP;
}
