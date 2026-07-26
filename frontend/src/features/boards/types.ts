import type { Stroke } from "@/lib/doodle";

/** A placed element on a mood board. Coordinates are px on the board canvas.
 * `rot` (degrees) and `w` (px) are optional on the kinds that predate free
 * rotate and resize, so older records still parse. */
interface ItemBase {
  id: string;
  x: number;
  y: number;
  rot?: number;
}

export interface NoteItem extends ItemBase {
  kind: "note";
  w?: number;
  text: string;
  color: NoteColor;
}
export interface TextItem extends ItemBase {
  kind: "text";
  text: string;
  w: number;
  size?: number; // font px — scales together with `w` on resize
  font?: TextFont;
  weight?: number;
  align?: TextAlign;
}
export interface LinkItem extends ItemBase {
  kind: "link";
  url: string;
  label: string;
}
export interface StickerItem extends ItemBase {
  kind: "sticker";
  rot: number;
  w?: number;
  emoji: string;
}
export interface PhotoItem extends ItemBase {
  kind: "photo";
  w: number;
  file: string;
  rot: number;
  frame: PhotoFrame;
  aspect: number; // width / height of the visible area (crop factor)
}
/** A labelled region. Anything sitting inside travels with it. */
export interface SectionItem extends ItemBase {
  kind: "section";
  w: number;
  h: number;
  label: string;
  color: SectionColor;
}
/** A placed doodle. Strokes are normalized: x spans 0–100 and y spans
 * 0–100/aspect, so the drawing scales losslessly with `w`. */
export interface DoodleItem extends ItemBase {
  kind: "doodle";
  w: number;
  aspect: number;
  strokes: Stroke[];
}

export type BoardItem =
  | NoteItem
  | TextItem
  | LinkItem
  | StickerItem
  | PhotoItem
  | SectionItem
  | DoodleItem;

export type ItemKind = BoardItem["kind"];

export type NoteColor = "honey" | "sky" | "leaf" | "clay" | "zest";
export type SectionColor = "sky" | "leaf" | "zest" | "clay";
export type PhotoFrame = "plain" | "polaroid" | "stamp";
export type TextFont = "display" | "body" | "mono";
export type TextAlign = "left" | "center" | "right";

export const NOTE_COLORS: NoteColor[] = ["honey", "sky", "leaf", "clay", "zest"];
export const SECTION_COLORS: SectionColor[] = ["sky", "leaf", "zest", "clay"];

/** The emoji palette offered for stickers (place + reskin). */
export const STICKERS = [
  "⭐", "🔥", "❤️", "✨", "🌈", "☕", "🎯", "💪", "🌿", "🎉", "😎", "📌", "🍕", "🏆", "🌸", "🦋",
];

export const TEXT_FONTS: TextFont[] = ["display", "body", "mono"];
export const TEXT_WEIGHTS: { label: string; value: number }[] = [
  { label: "Regular", value: 400 },
  { label: "Bold", value: 700 },
  { label: "Black", value: 900 },
];
export const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right"];
export const TEXT_DEFAULTS = {
  size: 18,
  font: "display" as TextFont,
  weight: 600,
  align: "left" as TextAlign,
};

/** Crop presets offered on a framed photo. */
export const ASPECTS: { label: string; value: number }[] = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 0.8 },
  { label: "3:4", value: 0.75 },
  { label: "3:2", value: 1.5 },
  { label: "16:9", value: 1.777 },
];

/** Default footprint per kind when a record predates the `w` field. */
export const DEFAULT_W: Record<ItemKind, number> = {
  note: 176,
  text: 200,
  link: 208,
  sticker: 56,
  photo: 176,
  section: 420,
  doodle: 140,
};

/** How far a resize handle may travel, per kind. */
export const SIZE_LIMITS: Record<ItemKind, { min: number; max: number }> = {
  note: { min: 96, max: 640 },
  text: { min: 72, max: 900 },
  link: { min: DEFAULT_W.link, max: DEFAULT_W.link },
  sticker: { min: 24, max: 240 },
  photo: { min: 72, max: 900 },
  section: { min: 160, max: 1400 },
  doodle: { min: 40, max: 900 },
};
export const SECTION_H_LIMITS = { min: 96, max: 1200 };

/** Height of a section's header bar. It doubles as the section's grab handle,
 * so the canvas needs the same number the header is drawn at. */
export const SECTION_HEAD_H = 30;

/** A section's corner radius, shared by the frame and by the highlight that
 * traces it while something is dragged over.
 *
 * Deliberately not `useCardRadius()`. That slider shapes the app's cards, and
 * a section is not one: it is a thing the user drew on their board, like the
 * sticky note's 3px paper corner or the polaroid's square one. Board objects
 * keep the geometry that makes them read as themselves; the chrome around them
 * — the shelf, the palettes, the inspector — is what follows the slider. */
export const SECTION_RADIUS = 18;

/** Current footprint width for an item, defaulting for records that predate `w`. */
export function widthOf(item: BoardItem): number {
  switch (item.kind) {
    case "note":
    case "sticker":
      return item.w ?? DEFAULT_W[item.kind];
    case "link":
      return DEFAULT_W.link;
    default:
      return item.w;
  }
}

/** Rendered height, needed to decide what a section is holding and to frame a
 * selection. Notes and text grow with their words, so this is the box the
 * layout reserves rather than a measured height. */
export function heightOf(item: BoardItem): number {
  switch (item.kind) {
    case "section":
      return item.h;
    case "photo":
      return widthOf(item) / item.aspect;
    case "doodle":
      return item.w / item.aspect;
    case "sticker":
      return widthOf(item) * 0.85;
    case "link":
      return 48;
    case "text":
      return (item.size ?? TEXT_DEFAULTS.size) * 1.4;
    case "note":
      return 96;
  }
}

/** Whether an item's anchor (top-centre-ish) sits inside a rect. This is what
 * decides section membership: a corner brushing the edge should not count, but
 * a piece visibly resting in the region should. */
export function anchorIn(
  item: BoardItem,
  x: number,
  y: number,
  r: { x: number; y: number; w: number; h: number },
): boolean {
  const ax = x + widthOf(item) / 2;
  const ay = y + 20;
  return ax >= r.x && ax <= r.x + r.w && ay >= r.y && ay <= r.y + r.h;
}

/** The board has no extent. Pieces carry plain canvas coordinates, positive or
 * negative, and nothing clamps where you can pan: the grid is a shader that
 * repeats forever and each piece places itself in screen space, so there is no
 * container to run out of.
 *
 * What an endless canvas does need is a way back, which is why `Frame content`
 * sits in the header rather than being a nice-to-have. */
export const SCALE_MIN = 0.15;
export const SCALE_MAX = 2.5;
/** Spacing of the dot grid, in canvas px. */
export const GRID = 26;

/** The box every piece on the board fits inside, or null when it is empty.
 * Used to frame the whole board in view. */
export function contentBounds(
  items: BoardItem[],
): { x: number; y: number; w: number; h: number } | null {
  if (items.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of items) {
    minX = Math.min(minX, i.x);
    minY = Math.min(minY, i.y);
    maxX = Math.max(maxX, i.x + widthOf(i));
    maxY = Math.max(maxY, i.y + heightOf(i));
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export interface Moodboard {
  id: string;
  title: string;
  items: BoardItem[];
  doodle: Stroke[];
  photos: string[]; // stored filenames
  updated: string;
}

export type BoardPatch = Partial<Pick<Moodboard, "title" | "items" | "doodle">>;

/** One saved drawing inside a pack — same normalized space as DoodleItem. */
export interface PackDoodle {
  id: string;
  name: string;
  strokes: Stroke[];
  aspect: number;
}

/** A named collection of saved doodles on the user's account, so every board
 * can stamp from the same set. */
export interface DoodlePack {
  id: string;
  title: string;
  doodles: PackDoodle[];
}
