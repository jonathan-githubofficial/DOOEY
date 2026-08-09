import { Dumbbell, Stamp, type LucideIcon } from "lucide-react-native";
import { useCallback } from "react";
import { hueOf } from "@/features/workouts/focus";
import { useCardInk, type CardInk } from "@/features/workouts/hues";
import type { CardHue } from "@/features/workouts/types";
import type { DayRitual } from "./api";
import type { RitualKind } from "./types";

/** Two glyphs, because there are two kinds of slot and no more.
 *
 * A tracker slot wears the stamp whatever it tracks. This file is where a fork
 * for meals and a bed for sleep would have gone, one line per aspect, and that
 * map is exactly what the change was made to delete. What tells one tracker's
 * slots from another's is colour, and that comes from the tracker record. */
export const RITUAL_ICON: Record<RitualKind, LucideIcon> = {
  training: Dumbbell,
  tracker: Stamp,
};

/** A slot wears the colour of the thing it is: training takes its routine's own
 * card hue, so a Push day looks the same on the planner as on the gym wall, and
 * a tracker slot takes the hue the user gave that tracker. Both resolve through
 * the palette, so retuning an accent in the Style studio repaints them. */
export function ritualHue(slot: DayRitual): CardHue {
  if (slot.ritual.kind === "tracker") return slot.tracker?.hue ?? "zest";
  return slot.routine ? hueOf(slot.routine) : "zest";
}

export function useRitualInk(): (slot: DayRitual) => CardInk {
  const ink = useCardInk();
  return useCallback((slot: DayRitual) => ink(ritualHue(slot)), [ink]);
}
