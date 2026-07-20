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

/** File plumbing a page provides when it can store attachments. */
export interface PageAttach {
  files: string[];
  busy?: boolean;
  urlFor: (filename: string) => string;
  onAdd: (files: File[]) => void;
  onRemove: (filename: string) => void;
}
