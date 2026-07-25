// The numbers the routine/session board is laid out with. Kept apart from the
// components so the masonry can estimate a card's height without rendering it.

/** Every card is title + meta + tag over a colour field; only the breathing
 * room above the title changes, and that's what gives the wall its rhythm. */
const BODY_H = 96;
const AIR_SHORT = 10;
const AIR_MEDIUM = 30;
const AIR_TALL = 52;

/** What a history card's stats strip adds under the tag. */
export const HISTORY_STATS_H = 44;

/** What the front/back figures add above the title on a routine card. */
export const TWIN_H = 104;

/** A card's headroom grows with the size of the routine — a nine-exercise day
 * should look heavier on the wall than a three-move finisher. */
export function cardAir(count: number): number {
  if (count <= 3) return AIR_SHORT;
  if (count <= 6) return AIR_MEDIUM;
  return AIR_TALL;
}

/** What the masonry packs with — no measurement pass, so the columns fill
 * deterministically and cards never reshuffle after paint. */
export function cardHeight(count: number, extra = 0): number {
  return BODY_H + cardAir(count) + extra;
}

/** Cards lean a hair, deterministically by position — the wall reads
 * hand-pinned rather than gridded. */
export function leanOf(index: number): string {
  return `${[-0.8, 0.6, -0.4, 0.9][index % 4]}deg`;
}
