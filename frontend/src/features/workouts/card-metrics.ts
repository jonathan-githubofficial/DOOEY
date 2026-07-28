// The numbers the routine/session board is laid out with. Kept apart from the
// components so the masonry can estimate a card's height without rendering it.

/** A session card is title + meta + tag over a colour field; only the breathing
 * room above the title changes, and that's what gives the history wall its
 * rhythm. Routine cards get theirs from the size of the figures instead. */
const BODY_H = 96;
const AIR_SHORT = 10;
const AIR_MEDIUM = 30;
const AIR_TALL = 52;

/** A routine card above its floor: padding, a hair of air, the name, and the
 * count on the line under it. No tag, because the figures already say what the
 * day trains. The count sits up here rather than beside them so the floor is
 * theirs alone — two figures of equal size sharing that row with it would have
 * to shrink by a third to fit a column this narrow. */
const ROUTINE_BODY_H = 87;

/** The share of a figure's box that is empty above its head and below its feet.
 *
 * The library draws its artwork inside a viewBox with dead margin all round, so
 * a figure box is not the figure — roughly a seventh of it is nothing. Cropping
 * both ends means the gap above the pair and the hang below it are the real
 * gaps you see, at any scale, rather than numbers with invisible padding
 * silently added to them. */
export const TWIN_HEAD = 0.066;
export const TWIN_FOOT = 0.067;

/** What's left: the figure itself, as a share of its box. */
export const TWIN_INK = 1 - TWIN_HEAD - TWIN_FOOT;

/** The gap above the figures, and the hair of them that hangs into the card's
 * bottom padding so they stand in the corner rather than float above it. */
const TWIN_LEAD = 14;
const TWIN_HANG = 4;

/** What a history card's stats strip adds under the tag. */
export const HISTORY_STATS_H = 44;

/** How big the figures stand, by how much the routine asks of you.
 *
 * The wall's rhythm used to come from dead headroom above the title, which is
 * a strange thing to vary. It comes from the drawing now: a nine-exercise day
 * literally looms larger on the board than a three-move finisher.
 *
 * The ceiling is set by the column, not by taste. Each figure renders 200×400
 * at scale 1 and the two stand side by side at the same size, so the pair is
 * always about as wide as it is tall — at 0.349 it leaves a two-column card the
 * margin a plate in a book would have, and anything past that is wall-to-wall. */
export function twinScale(count: number): number {
  if (count <= 3) return 0.27;
  if (count <= 6) return 0.31;
  return 0.349;
}

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

/** A routine card: the name and count up top, the figures on the floor below
 * them. A routine built only from moves the library doesn't know has no figures
 * to show, and gives that room back rather than leaving a hole. */
export function routineHeight(count: number, hasFigures: boolean): number {
  if (!hasFigures) return ROUTINE_BODY_H;
  return ROUTINE_BODY_H + 400 * twinScale(count) * TWIN_INK + TWIN_LEAD - TWIN_HANG;
}

/** Cards lean a hair, deterministically by position — the wall reads
 * hand-pinned rather than gridded. */
export function leanOf(index: number): string {
  return `${[-0.8, 0.6, -0.4, 0.9][index % 4]}deg`;
}
