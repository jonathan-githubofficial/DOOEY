import { Dumbbell, UtensilsCrossed, type LucideIcon } from "lucide-react-native";
import { useCallback } from "react";
import { hueOf } from "@/features/workouts/focus";
import { useCardInk, type CardInk } from "@/features/workouts/hues";
import type { CardHue } from "@/features/workouts/types";
import type { DayRitual } from "./api";
import type { RitualKind } from "./types";

export const RITUAL_ICON: Record<RitualKind, LucideIcon> = {
  gym: Dumbbell,
  journal: UtensilsCrossed,
};

/** A slot wears the colour of the thing it is: training takes its routine's
 * own card hue, so a Push day looks the same on the planner as on the gym
 * wall, and a meal is honey, the Journal's colour. Both resolve through the
 * palette, so retuning an accent in the Style studio repaints them. */
export function ritualHue(slot: DayRitual): CardHue {
  if (slot.ritual.kind === "journal") return "honey";
  return slot.routine ? hueOf(slot.routine) : "zest";
}

export function useRitualInk(): (slot: DayRitual) => CardInk {
  const ink = useCardInk();
  return useCallback((slot: DayRitual) => ink(ritualHue(slot)), [ink]);
}
