import { canonicalMuscle } from "./anatomy";
import type { ExerciseKind } from "./types";
import data from "./exercises.json";
import keys360 from "./media360.json";

// The exercise library — the open-source ExerciseDB v1 dataset: 1,500
// exercises, each with an animated 3D-model demonstration GIF (target muscle
// highlighted) and step-by-step instructions.
//
// The demos come in two rungs, and both hosts are pinned to a commit SHA so
// the URLs can't drift:
//   180px — the dataset's own thumbnails, keyed by exercise id.
//   360px — the same animations at 2×, from a mirror that keys them by the
//           dataset's *other* id scheme (a 4-digit number), hence media360.json.
// 360 is the best free rung that exists for this artwork; above it the art is
// only sold, and the vendor's own public previews are themselves 180px.
const GIF_180 =
  "https://raw.githubusercontent.com/bootstrapping-lab/exercisedb-api/7cdc82e1a14b06799d16c819d1082f3debb425ce/media/";
const GIF_360 =
  "https://raw.githubusercontent.com/omercotkd/exercises-gifs/ebf642cd90fdf73a6c73e7127e93b607b12c229e/assets/";

// "london bridge" is the single animation that mirror is missing.
const GIF_360_ELSEWHERE: Record<string, string> = {
  bLyQokI:
    "https://raw.githubusercontent.com/ThienDuc3112/exercises/fbd2b4df000d3a1085b1839c9b3fa2107da91175/data/gif/0609.gif",
};

const KEY_360 = keys360 as Record<string, string>;

export interface LibraryExercise {
  id: string;
  name: string;
  /** The muscle the movement is *for*. Upstream gives exactly one. */
  targets: string[];
  /** Everything else it works, in upstream's own loose vocabulary ("shoulders",
   * "core", "rear deltoids") — normalized by `exerciseMuscles`. */
  secondary: string[];
  parts: string[];
  equip: string[];
  steps: string[];
}

export const LIBRARY = data as LibraryExercise[];

const byId = new Map(LIBRARY.map((e) => [e.id, e]));
export function libraryExercise(id: string | undefined): LibraryExercise | undefined {
  return id ? byId.get(id) : undefined;
}

/** Title-case a library name for display — the dataset stores lowercase. */
export function prettyName(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The demo animation for an exercise. Pass 180 for the small list thumbnails —
 * they render at 40–60px, where 360 is three times the bytes for no visible
 * gain. Everything shown large takes the default. `media360.json` is generated
 * from `exercises.json`, so a missing key means the two have drifted apart;
 * degrade to the 180 rung rather than render a broken image. */
export function exerciseGif(ex: LibraryExercise, res: 180 | 360 = 360): string {
  if (res === 360) {
    const alt = GIF_360_ELSEWHERE[ex.id];
    if (alt) return alt;
    const key = KEY_360[ex.id];
    if (key) return `${GIF_360}${key}.gif`;
  }
  return `${GIF_180}${ex.id}.gif`;
}

/** The muscle-group lens: filter by the muscle an exercise actually works.
 * `key` matches the dataset's raw `targets` value; `label` is what the chip
 * shows. Ordered head-to-toe, most-populated first within a region. */
export interface MuscleGroup {
  key: string;
  label: string;
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { key: "all", label: "All" },
  { key: "pectorals", label: "Chest" },
  { key: "delts", label: "Shoulders" },
  { key: "biceps", label: "Biceps" },
  { key: "triceps", label: "Triceps" },
  { key: "forearms", label: "Forearms" },
  { key: "lats", label: "Lats" },
  { key: "upper back", label: "Upper back" },
  { key: "traps", label: "Traps" },
  { key: "abs", label: "Abs" },
  { key: "glutes", label: "Glutes" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "calves", label: "Calves" },
  { key: "adductors", label: "Adductors" },
  { key: "abductors", label: "Abductors" },
  { key: "spine", label: "Lower back" },
  { key: "cardiovascular system", label: "Cardio" },
];

/** Every exercise logs weight × reps — the universal gym set. Bodyweight
 * movements just leave the weight at zero (or log added weight). */
export function kindOf(): ExerciseKind {
  return "weight_reps";
}

/** What an exercise works, in the app's own muscle vocabulary: what it is for,
 * and what it also uses.
 *
 * Both lists are normalized and deduped, and a muscle that is already primary
 * is never repeated as secondary — otherwise a curl would list biceps twice and
 * the figure would shade it at the weaker strength. */
export function exerciseMuscles(ex: { targets: string[]; secondary?: string[] }): {
  primary: string[];
  secondary: string[];
} {
  const primary = [...new Set(ex.targets.map(canonicalMuscle).filter(Boolean))];
  const seen = new Set(primary);
  const secondary: string[] = [];
  for (const raw of ex.secondary ?? []) {
    const m = canonicalMuscle(raw);
    if (!m || seen.has(m)) continue;
    seen.add(m);
    secondary.push(m);
  }
  return { primary, secondary };
}

export function searchLibrary(query: string, muscle: string): LibraryExercise[] {
  const q = query.trim().toLowerCase();
  return LIBRARY.filter((ex) => {
    // The muscle lens matches what the movement is for, not everything it
    // brushes: filtering "biceps" should not return every row and chin-up.
    if (muscle !== "all" && !ex.targets.includes(muscle)) return false;
    if (!q) return true;
    return (
      ex.name.toLowerCase().includes(q) ||
      ex.targets.some((m) => m.includes(q)) ||
      ex.equip.some((e) => e.includes(q))
    );
  });
}
