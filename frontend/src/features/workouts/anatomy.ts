import type { ExtendedBodyPart, Slug } from "react-native-body-highlighter";

export type Side = "front" | "back";
export type Placed = { slug: Slug; side: Side };

/** Which slugs each view of the figure actually draws.
 *
 * Read off the library's own assets (`dist/assets/bodyFront.js`,
 * `bodyBack.js`), not guessed — `anatomy.test.ts` re-reads those files and
 * fails if a package upgrade moves a part. This is the fact that used to be
 * restated by hand, one side per muscle, which is how the shoulders, forearms,
 * calves, triceps and traps ended up unable to light on half the body. */
const FRONT: Slug[] = [
  "abs",
  "adductors",
  "ankles",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "feet",
  "forearm",
  "hair",
  "hands",
  "head",
  "knees",
  "neck",
  "obliques",
  "quadriceps",
  "tibialis",
  "trapezius",
  "triceps",
];

const BACK: Slug[] = [
  "adductors",
  "ankles",
  "calves",
  "deltoids",
  "feet",
  "forearm",
  "gluteal",
  "hair",
  "hamstring",
  "hands",
  "head",
  "lower-back",
  "neck",
  "trapezius",
  "triceps",
  "upper-back",
];

export const SLUGS_ON: Record<Side, Slug[]> = { front: FRONT, back: BACK };

/** Every part the figure is made of. The library's own assets hard-code
 * `color: "#3f3f3f"` on each one, and per-part colour outranks `defaultFill`,
 * so the only way to keep the body on DOOEY's paper palette is to hand it an
 * explicit colour for every part — hence this list. */
const SLUGS: Slug[] = [...new Set([...FRONT, ...BACK])].sort();

/** One entry per body part: the muscles in `worked` wear their colour, every
 * other part wears `resting`. Nothing is left to the library's default, which
 * is a near-black it can't be talked out of. */
export function bodyData(worked: Map<Slug, string>, resting: string): ExtendedBodyPart[] {
  return SLUGS.map((slug) => ({ slug, color: worked.get(slug) ?? resting }));
}

/** A muscle name → the part of the figure that stands for it.
 *
 * The figure is coarser than the dataset, so several muscles share a slug:
 * there is no lat separate from the upper back, no abductor separate from the
 * glute. Those folds are the honest limit of the artwork. What is *not* here is
 * any claim about which way the body has to be facing — that comes from
 * `SLUGS_ON`, so a muscle you can see from both sides lights from both. */
const TARGET_SLUG: Record<string, Slug> = {
  // Front of the trunk
  pectorals: "chest",
  abs: "abs",
  obliques: "obliques",
  "serratus anterior": "obliques",
  // Back of the trunk
  lats: "upper-back",
  "upper back": "upper-back",
  rhomboids: "upper-back",
  spine: "lower-back",
  traps: "trapezius",
  "levator scapulae": "trapezius",
  neck: "neck",
  // Arms and shoulders
  delts: "deltoids",
  biceps: "biceps",
  triceps: "triceps",
  forearms: "forearm",
  // Legs
  glutes: "gluteal",
  abductors: "gluteal",
  hamstrings: "hamstring",
  quads: "quadriceps",
  adductors: "adductors",
  calves: "calves",
  tibialis: "tibialis",
};

/** The dataset's free-text `secondaryMuscles` vocabulary, folded onto the
 * muscle names above. Upstream writes these by hand per exercise, so it says
 * "shoulders" and "deltoids" and "rear deltoids" for the same thing.
 *
 * A few entries deliberately resolve to nothing: wrists, hands, feet and
 * "ankle stabilizers" are joints and grip, not muscles the figure shades, and
 * lighting them up for every deadlift would be noise. */
const SECONDARY_ALIAS: Record<string, string> = {
  shoulders: "delts",
  deltoids: "delts",
  "rear deltoids": "delts",
  "rotator cuff": "delts",
  hamstrings: "hamstrings",
  forearms: "forearms",
  wrists: "forearms",
  "wrist extensors": "forearms",
  "wrist flexors": "forearms",
  "grip muscles": "forearms",
  triceps: "triceps",
  biceps: "biceps",
  brachialis: "biceps",
  quadriceps: "quads",
  // The hip flexors run under the quads and have no slug of their own; the
  // rectus femoris genuinely crosses the hip, so this is the nearest truth.
  "hip flexors": "quads",
  calves: "calves",
  soleus: "calves",
  shins: "tibialis",
  glutes: "glutes",
  core: "abs",
  abdominals: "abs",
  "lower abs": "abs",
  obliques: "obliques",
  chest: "pectorals",
  "upper chest": "pectorals",
  "lower back": "spine",
  rhomboids: "rhomboids",
  trapezius: "traps",
  traps: "traps",
  "upper back": "upper back",
  back: "upper back",
  "latissimus dorsi": "lats",
  lats: "lats",
  sternocleidomastoid: "neck",
  groin: "adductors",
  "inner thighs": "adductors",
};

/** Normalize one muscle name from either vocabulary. Returns "" for anything
 * the figure has no part for, so callers can filter in one step. */
export function canonicalMuscle(name: string): string {
  const key = name.trim().toLowerCase();
  if (TARGET_SLUG[key]) return key;
  return SECONDARY_ALIAS[key] ?? "";
}

/** Where a muscle shows, on both sides when the figure draws it on both.
 * Unknown muscles (and "cardiovascular system") place nowhere. */
export function placementsFor(muscle: string): Placed[] {
  const slug = TARGET_SLUG[canonicalMuscle(muscle)];
  if (!slug) return [];
  const out: Placed[] = [];
  if (FRONT.includes(slug)) out.push({ slug, side: "front" });
  if (BACK.includes(slug)) out.push({ slug, side: "back" });
  return out;
}

/** How hard a muscle is shaded. A primary muscle is what the movement is *for*;
 * a secondary one is along for the ride, and reads as a wash so the figure
 * still answers "what is this exercise" at a glance. */
export const SECONDARY_STRENGTH = 0.38;

export interface Paint {
  color: string;
  /** A muscle the movement is for. Secondary muscles wash out. */
  strong: boolean;
}

/** Build the painted-muscle map every figure takes, from two lists and a tint. */
export function paintOf(primary: string[], secondary: string[], color: string): Map<string, Paint> {
  const out = new Map<string, Paint>();
  for (const m of secondary) out.set(m, { color, strong: false });
  // Primary last: it overwrites a muscle that arrived as both.
  for (const m of primary) out.set(m, { color, strong: true });
  return out;
}

/** Resolve painted muscles onto one view's slugs.
 *
 * Where two muscles share a slug the stronger claim wins, so a pull day that
 * targets the lats and merely uses the rhomboids doesn't wash out the one patch
 * of back the figure has for both. */
export function paintSide(painted: Map<string, Paint>, side: Side): Map<Slug, Paint> {
  const out = new Map<Slug, Paint>();
  for (const [muscle, paint] of painted) {
    for (const placed of placementsFor(muscle)) {
      if (placed.side !== side) continue;
      const held = out.get(placed.slug);
      if (!held || (paint.strong && !held.strong)) out.set(placed.slug, paint);
    }
  }
  return out;
}

/** Which view shows more of this work. Ties — and an untrained body — go to
 * the front, the side people expect to see first. Primary muscles are what
 * decide it; a back full of incidental shading shouldn't spin the figure. */
export function busiestSide(painted: Map<string, Paint>): Side {
  let front = 0;
  let back = 0;
  for (const [muscle, paint] of painted) {
    if (!paint.strong) continue;
    for (const placed of placementsFor(muscle)) {
      if (placed.side === "front") front++;
      else back++;
    }
  }
  return back > front ? "back" : "front";
}
