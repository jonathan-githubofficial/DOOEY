import type { Stroke } from "@/lib/doodle";

/** A placed element on a mood board. Coordinates are px on the board canvas. */
// `rot` (degrees) and `w` (px) are optional on the older kinds so records
// created before free rotate/resize still parse — the UI falls back to sane
// defaults. `parent` set means the item lives inside a folder (a `group`
// item) and is hidden from the canvas until ejected.
interface ItemBase {
  id: string;
  x: number;
  y: number;
  rot?: number;
  parent?: string;
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
/** A folder: closed it's a small tab you drop things onto; open it spreads
 * into a `w`×`h` panel showing what's inside. */
export interface GroupItem extends ItemBase {
  kind: "group";
  w: number;
  h: number;
  label: string;
  color: GroupColor;
}
/** A section: a labelled region — anything sitting inside moves with it. */
export interface SectionItem extends ItemBase {
  kind: "section";
  w: number;
  h: number;
  label: string;
  color: GroupColor;
}
/** A placed doodle from a pack. Strokes are normalized: x spans 0–100 and y
 * spans 0–100/aspect, so the drawing scales losslessly with `w`. */
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
  | GroupItem
  | SectionItem
  | DoodleItem;

export type NoteColor = "honey" | "sky" | "leaf" | "clay" | "zest";
export type GroupColor = "sky" | "leaf" | "zest" | "clay";
export type PhotoFrame = "plain" | "polaroid" | "stamp";
export type TextFont = "display" | "body" | "mono";

export const TEXT_FONT_CLASS: Record<TextFont, string> = {
  display: "font-display tracking-tight",
  body: "font-sans",
  mono: "font-mono tracking-tight",
};
export const TEXT_WEIGHTS: { label: string; value: number }[] = [
  { label: "Regular", value: 400 },
  { label: "Bold", value: 700 },
  { label: "Black", value: 900 },
];
export const TEXT_DEFAULTS = { size: 18, font: "display" as TextFont, weight: 600 };

/** The emoji palette offered for stickers (add + reskin). */
export const STICKERS = [
  "⭐", "🔥", "❤️", "✨", "🌈", "☕", "🎯", "💪", "🌿", "🎉", "😎", "📌", "🍕", "🏆", "🌸", "🦋",
];

/** Default footprint per kind when a record predates the `w` field. */
export const DEFAULT_W: Record<BoardItem["kind"], number> = {
  note: 176,
  text: 200,
  link: 208,
  sticker: 56,
  photo: 176,
  group: 320,
  section: 420,
  doodle: 140,
};

/** A closed folder's on-canvas footprint (its open size is the item's w×h). */
export const FOLDER_W = 132;
export const FOLDER_H = 96;

/** Current footprint width for an item, defaulting for records that predate `w`. */
export function widthOf(item: BoardItem): number {
  switch (item.kind) {
    case "note":
    case "sticker":
      return item.w ?? DEFAULT_W[item.kind];
    case "link":
      return DEFAULT_W.link;
    case "group":
      return FOLDER_W;
    default:
      return item.w;
  }
}

/** Crop presets offered at import (and when reframing) — label + width/height. */
export const ASPECTS: { label: string; value: number }[] = [
  { label: "1:1", value: 1 },
  { label: "4:5", value: 0.8 },
  { label: "3:4", value: 0.75 },
  { label: "3:2", value: 1.5 },
  { label: "16:9", value: 1.777 },
];

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

/** A named collection of saved doodles on the user's account. Owner-scoped
 * like everything else, so sharing packs later is a rules change. */
export interface DoodlePack {
  id: string;
  title: string;
  doodles: PackDoodle[];
}
