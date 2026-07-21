import type { ExerciseKind } from "./types";
import data from "./exercises.json";

// The exercise library — the open-source ExerciseDB v1 dataset: 1,500
// exercises, each with an animated 3D-model demonstration GIF (target muscle
// highlighted) and step-by-step instructions. GIFs are pinned to the repo
// commit the dataset was taken from, so the URLs can't drift.
const GIF_HOST =
  "https://raw.githubusercontent.com/bootstrapping-lab/exercisedb-api/7cdc82e1a14b06799d16c819d1082f3debb425ce/media/";

export interface LibraryExercise {
  id: string;
  name: string;
  targets: string[];
  parts: string[];
  equip: string[];
  steps: string[];
}

export const LIBRARY = data as LibraryExercise[];

const byId = new Map(LIBRARY.map((e) => [e.id, e]));
export function libraryExercise(id: string | undefined): LibraryExercise | undefined {
  return id ? byId.get(id) : undefined;
}

export function exerciseGif(ex: LibraryExercise): string {
  return `${GIF_HOST}${ex.id}.gif`;
}

/** The training-split lens: push / pull / legs / core / cardio. Body parts
 * decide legs, core and cardio; chest and shoulders push; back pulls; arms
 * split by their target muscle. */
export const GROUPS = ["all", "push", "pull", "legs", "core", "cardio"] as const;
export type LibraryGroup = (typeof GROUPS)[number];

const PUSH_TARGETS = new Set(["pectorals", "delts", "triceps", "serratus anterior"]);

export function groupOf(ex: LibraryExercise): Exclude<LibraryGroup, "all"> | null {
  const part = ex.parts[0];
  if (part === "cardio") return "cardio";
  if (part === "waist") return "core";
  if (part === "upper legs" || part === "lower legs") return "legs";
  if (part === "chest" || part === "shoulders") return "push";
  if (part === "back" || part === "neck") return "pull";
  // Arms and the rest split by what they actually work.
  const target = ex.targets[0] ?? "";
  return PUSH_TARGETS.has(target) ? "push" : "pull";
}

/** How a library exercise is logged: cardio by time, bodyweight by reps,
 * everything racked by weight × reps. */
export function kindOf(ex: LibraryExercise): ExerciseKind {
  if (ex.parts[0] === "cardio") return "duration";
  if (ex.equip.every((e) => e === "body weight")) return "reps";
  return "weight_reps";
}

export function searchLibrary(query: string, group: LibraryGroup): LibraryExercise[] {
  const q = query.trim().toLowerCase();
  return LIBRARY.filter((ex) => {
    if (group !== "all" && groupOf(ex) !== group) return false;
    if (!q) return true;
    return (
      ex.name.toLowerCase().includes(q) ||
      ex.targets.some((m) => m.includes(q)) ||
      ex.equip.some((e) => e.includes(q))
    );
  });
}
