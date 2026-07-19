// The building blocks of a "page" — the structured content every page-like
// thing in DOOEY (task pages, learning-session pages) shares.

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Resource {
  id: string;
  url: string;
  label: string;
  kind: "link" | "youtube";
}

/** A placed page decoration: an emoji sticker, or a photo framed as polaroid/stamp. */
export interface DecorItem {
  id: string;
  kind: "sticker" | "photo";
  emoji?: string;
  file?: string; // stored filename, resolved by the page's urlFor
  x: number; // % of page width (item center)
  y: number; // % of page height (item center)
  rot: number; // degrees
  style?: "polaroid" | "stamp";
}

/** File plumbing a page provides when it can store attachments. */
export interface PageAttach {
  files: string[];
  busy?: boolean;
  urlFor: (filename: string) => string;
  onAdd: (files: File[]) => void;
  onRemove: (filename: string) => void;
}
