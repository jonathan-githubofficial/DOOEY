import type { ExtendedBodyPart, Slug } from "react-native-body-highlighter";

export type Placed = { slug: Slug; side: "front" | "back" };

/** Every part the figure is made of. The library's own assets hard-code
 * `color: "#3f3f3f"` on each one, and per-part colour outranks `defaultFill`,
 * so the only way to keep the body on DOOEY's paper palette is to hand it an
 * explicit colour for every part — hence this list. Mirrors the `Slug` union. */
const SLUGS: Slug[] = [
  "abs",
  "adductors",
  "ankles",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "feet",
  "forearm",
  "gluteal",
  "hair",
  "hamstring",
  "hands",
  "head",
  "knees",
  "lower-back",
  "neck",
  "obliques",
  "quadriceps",
  "tibialis",
  "trapezius",
  "triceps",
  "upper-back",
];

/** One entry per body part: the muscles in `worked` wear their colour, every
 * other part wears `resting`. Nothing is left to the library's default, which
 * is a near-black it can't be talked out of. */
export function bodyData(worked: Map<Slug, string>, resting: string): ExtendedBodyPart[] {
  return SLUGS.map((slug) => ({ slug, color: worked.get(slug) ?? resting }));
}

/** ExerciseDB target muscle → the body-highlighter slug + the view that shows
 * it. The dataset is finer than the figure (no lats/traps/abductors slugs), so
 * a few fold into their nearest region. Shared by both figures — the exercise
 * map and the week body must agree on where a muscle lives. */
export const MUSCLE_SLUG: Record<string, Placed> = {
  pectorals: { slug: "chest", side: "front" },
  abs: { slug: "abs", side: "front" },
  biceps: { slug: "biceps", side: "front" },
  delts: { slug: "deltoids", side: "front" },
  forearms: { slug: "forearm", side: "front" },
  quads: { slug: "quadriceps", side: "front" },
  adductors: { slug: "adductors", side: "front" },
  "serratus anterior": { slug: "obliques", side: "front" },
  triceps: { slug: "triceps", side: "back" },
  calves: { slug: "calves", side: "back" },
  glutes: { slug: "gluteal", side: "back" },
  abductors: { slug: "gluteal", side: "back" },
  hamstrings: { slug: "hamstring", side: "back" },
  lats: { slug: "upper-back", side: "back" },
  "upper back": { slug: "upper-back", side: "back" },
  traps: { slug: "trapezius", side: "back" },
  "levator scapulae": { slug: "trapezius", side: "back" },
  spine: { slug: "lower-back", side: "back" },
};
