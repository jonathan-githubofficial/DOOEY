import { libraryExercise, prettyName } from "./library";
import type { ExerciseKind, RoutineItem } from "./types";

// The starter routines seeded on first open — a Push / Pull / Legs split built
// from verified library exercises, so the gym is alive on arrival. Each tuple
// is [libId, sets, reps, restSeconds]; kind is inferred from the library.
type Seed = [string, number, number, number];

function items(seeds: Seed[]): RoutineItem[] {
  return seeds.flatMap(([libId, sets, reps, rest]) => {
    const ex = libraryExercise(libId);
    if (!ex) return [];
    const kind: ExerciseKind =
      ex.equip.every((e) => e === "body weight") ? "reps" : "weight_reps";
    return [{ name: prettyName(ex.name), kind, sets, target_reps: reps, target_weight: 0, rest, libId }];
  });
}

export const STARTER_ROUTINES = [
  {
    name: "Push day",
    group: "Push",
    description: "Chest, shoulders and triceps — the pressing half of the week.",
    items: items([
      ["EIeI8Vf", 4, 8, 150], // barbell bench press
      ["3TZduzM", 3, 10, 120], // barbell incline bench press
      ["znQUdHY", 3, 10, 90], // dumbbell seated shoulder press
      ["yz9nUhF", 3, 12, 60], // dumbbell fly
      ["3ZflifB", 3, 12, 60], // cable pushdown
    ]),
  },
  {
    name: "Pull day",
    group: "Pull",
    description: "Back and biceps — everything you row and hang from.",
    items: items([
      ["ila4NZS", 4, 6, 180], // barbell deadlift
      ["lBDjFxJ", 3, 8, 120], // pull-up
      ["BJ0Hz5L", 3, 10, 90], // dumbbell bent over row
      ["fUBheHs", 3, 12, 75], // cable seated row
      ["ae9UoXQ", 3, 12, 60], // dumbbell incline curl
    ]),
  },
  {
    name: "Leg day",
    group: "Legs",
    description: "Quads, hamstrings and calves — the honest work.",
    items: items([
      ["qXTaZnJ", 4, 8, 180], // barbell full squat
      ["wQ2c4XD", 3, 10, 120], // barbell romanian deadlift
      ["my33uHU", 3, 12, 75], // lever leg extension
      ["17lJ1kr", 3, 12, 75], // lever lying leg curl
      ["dPmaUaU", 4, 15, 60], // dumbbell standing calf raise
    ]),
  },
];
