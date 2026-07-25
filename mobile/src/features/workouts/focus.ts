import { libraryExercise, MUSCLE_GROUPS, prettyName } from "./library";
import type { CardHue, Routine } from "./types";

/** Which DOOEY accent a muscle wears — grouped by region so a card's colour
 * reads as its focus (push = clay, pull = sky, legs = leaf, arms = honey…). */
export const MUSCLE_HUE: Record<string, CardHue> = {
  pectorals: "clay",
  delts: "honey",
  biceps: "honey",
  triceps: "honey",
  forearms: "honey",
  lats: "sky",
  "upper back": "sky",
  traps: "sky",
  spine: "sky",
  abs: "zest",
  glutes: "leaf",
  quads: "leaf",
  hamstrings: "leaf",
  calves: "leaf",
  adductors: "leaf",
  abductors: "leaf",
  "cardiovascular system": "zest",
};

export interface Focus {
  /** The dominant muscle, in words — the card's tag. */
  label: string;
  /** That muscle's accent, as a palette token key. Resolved by the caller so
   * this module stays pure and the choice survives a palette edit. */
  hueKey: CardHue;
  /** Every muscle worked, most-trained first — what the body figure shades. */
  targets: string[];
}

/** What a routine or session trains. Tallies target muscles across every
 * library-backed exercise; a list of only custom moves has no focus. */
export function focusOf(items: { libId?: string }[]): Focus | null {
  const tally = new Map<string, number>();
  for (const it of items) {
    const ex = libraryExercise(it.libId);
    if (!ex) continue;
    for (const t of ex.targets) tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  if (tally.size === 0) return null;
  const targets = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const top = targets[0];
  return {
    label: MUSCLE_GROUPS.find((g) => g.key === top)?.label ?? prettyName(top),
    hueKey: MUSCLE_HUE[top] ?? "zest",
    targets,
  };
}

/** A card's colour: what you chose, else what it trains, else the house
 * accent. Every card has a hue — "undecided" is not a state the wall shows. */
export function hueOf(routine: { hue: Routine["hue"]; items: { libId?: string }[] }): CardHue {
  return routine.hue || focusOf(routine.items)?.hueKey || "zest";
}
