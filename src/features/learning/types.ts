import type { Stroke } from "@/lib/doodle";

/** The files the learning-architect skill produces, keyed by filename. */
export type ProgramFiles = Record<string, string>;

export type FolderHue = "sky" | "zest" | "leaf" | "clay" | "honey";
export type FolderFont = "display" | "body" | "mono";

export const FOLDER_FONT_CLASS: Record<FolderFont, string> = {
  display: "font-display tracking-tight",
  body: "font-sans",
  mono: "font-mono tracking-tight",
};

/** How the owner dressed up this project's folder. Everything optional — an
 * unset field falls back to the category-derived default. */
export interface FolderStyle {
  hue?: FolderHue;
  font?: FolderFont;
  /** Strokes drawn on the folder front, in % of its face. */
  doodle?: Stroke[];
}

/** A learning program imported from a skill bundle (and mirrored to PocketBase). */
export interface GeneratedProgram {
  id: string;
  /** Short title — 5 words or fewer. Shown on the folder tab. */
  goal: string;
  /** One line: why this matters. Shown under the title. */
  why?: string;
  files: ProgramFiles;
  createdAt: string;
  /** PocketBase record id, set once the program is mirrored server-side. */
  pbId?: string;
  folder?: FolderStyle;
  /** Stored filename of the cover picture filling the folder front. */
  cover?: string;
  /** True once the program's sessions have been turned into project tasks. */
  materialized?: boolean;
}

/** One tickable line parsed out of SCHEDULE.md. */
export interface ScheduleSession {
  key: string;
  label: string;
  date: string | null;
  /** The middle segment exactly as written ("Tue 2026-07-14"), so edits round-trip. */
  dateRaw: string;
  topic: string;
  isGate: boolean;
  doneInFile: boolean;
  /** Index of this session's line in SCHEDULE.md — the anchor for editing it. */
  line: number;
}

/** A `## `-delimited group of sessions in SCHEDULE.md (a track or phase). */
export interface ScheduleGroup {
  title: string;
  sessions: ScheduleSession[];
}
