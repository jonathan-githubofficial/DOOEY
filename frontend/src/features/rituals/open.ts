import { useRouter } from "expo-router";
import { useLiveWorkout, useStartWorkout } from "@/features/workouts/api";
import { hapticTap } from "@/lib/haptics";
import type { DayRitual } from "./api";

/** What tapping a slot does, wherever it is drawn — the list slip, the
 * timeline block, the week column all share this so the planner never offers
 * the same slot two different behaviours.
 *
 * The shortest path to doing the thing is the whole point: a training slot
 * starts its session from the planner rather than sending you to the gym wall
 * to find the card. */
export function useOpenSlot(): (slot: DayRitual) => void {
  const router = useRouter();
  const start = useStartWorkout();
  const live = useLiveWorkout();

  return (slot) => {
    hapticTap();
    if (slot.ritual.kind === "journal") {
      router.push("/journal");
      return;
    }
    // At most one session is ever open. If one is running — this slot's or
    // another's — go to it rather than quietly opening a second.
    const openId = live?.id ?? slot.workoutId;
    if (openId) {
      router.push({ pathname: "/workout/[id]", params: { id: openId } });
      return;
    }
    // A ritual with no routine picked yet has nothing to instantiate.
    if (!slot.routine) {
      router.push("/gym");
      return;
    }
    start.mutate(
      { id: slot.routine.id, name: slot.routine.name, items: slot.routine.items },
      { onSuccess: (w) => router.push({ pathname: "/workout/[id]", params: { id: w.id } }) },
    );
  };
}
