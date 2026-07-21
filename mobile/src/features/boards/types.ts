import type { Stroke } from "@/lib/doodle";

/** A placed element on a mood board. Coordinates are px on the board canvas —
 * the same record shape as the web app, so boards round-trip. */
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
  size?: number;
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
  aspect: number;
}
export interface GroupItem extends ItemBase {
  kind: "group";
  w: number;
  h: number;
  label: string;
  color: GroupColor;
}
export interface SectionItem extends ItemBase {
  kind: "section";
  w: number;
  h: number;
  label: string;
  color: GroupColor;
}
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

export const NOTE_COLORS: NoteColor[] = ["honey", "sky", "leaf", "clay", "zest"];

/** The emoji palette offered for stickers. */
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

export interface Moodboard {
  id: string;
  title: string;
  items: BoardItem[];
  doodle: Stroke[];
  photos: string[];
  updated: string;
}

export type BoardPatch = Partial<Pick<Moodboard, "title" | "items" | "doodle">>;
