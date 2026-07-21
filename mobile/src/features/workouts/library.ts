import type { ExerciseKind } from "./types";
import data from "./exercises.json";

// The open-source exercise library — free-exercise-db (yuhonas), public
// domain (Unlicense): 873 exercises, each with two demonstration photos
// (start/end position) hosted from the project's repo.
const IMAGE_HOST = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export interface LibraryExercise {
  id: string;
  name: string;
  force: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  category: string;
  images: string[];
}

export const LIBRARY = data as LibraryExercise[];

const byId = new Map(LIBRARY.map((e) => [e.id, e]));
export function libraryExercise(id: string | undefined): LibraryExercise | undefined {
  return id ? byId.get(id) : undefined;
}

export function exerciseImage(ex: LibraryExercise, frame = 0): string {
  return IMAGE_HOST + ex.images[Math.min(frame, ex.images.length - 1)];
}

/** The training-split lens: push / pull / legs / core / cardio. Legs and core
 * are muscle-driven; push and pull fall back to the dataset's force field. */
export const GROUPS = ["all", "push", "pull", "legs", "core", "cardio"] as const;
export type LibraryGroup = (typeof GROUPS)[number];

const LEG_MUSCLES = new Set([
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
]);

export function groupOf(ex: LibraryExercise): Exclude<LibraryGroup, "all"> | null {
  if (ex.category === "cardio") return "cardio";
  const main = ex.primaryMuscles[0];
  if (main === "abdominals") return "core";
  if (main && LEG_MUSCLES.has(main)) return "legs";
  if (ex.force === "push") return "push";
  if (ex.force === "pull") return "pull";
  return null;
}

/** How a library exercise is logged: cardio and stretches by time, bodyweight
 * strength by reps, everything racked by weight × reps. */
export function kindOf(ex: LibraryExercise): ExerciseKind {
  if (ex.category === "cardio" || ex.category === "stretching") return "duration";
  if (ex.equipment === "body only") return "reps";
  return "weight_reps";
}

export function searchLibrary(query: string, group: LibraryGroup): LibraryExercise[] {
  const q = query.trim().toLowerCase();
  return LIBRARY.filter((ex) => {
    if (group !== "all" && groupOf(ex) !== group) return false;
    if (!q) return true;
    return (
      ex.name.toLowerCase().includes(q) ||
      ex.primaryMuscles.some((m) => m.includes(q)) ||
      (ex.equipment ?? "").includes(q)
    );
  });
}
