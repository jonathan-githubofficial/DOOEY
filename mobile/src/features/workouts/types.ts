import type { Stroke } from "@/lib/doodle";

/** How an exercise is measured — weights racked, bodyweight reps, or a hold. */
export type ExerciseKind = "weight_reps" | "reps" | "duration";

/** One exercise line in a routine template. `libId` ties it to the bundled
 * open-source library (photos, muscles); custom exercises go without. */
export interface RoutineItem {
  name: string;
  kind: ExerciseKind;
  sets: number;
  target_reps: number;
  target_weight: number; // 0 for reps/duration kinds; seconds for duration
  rest?: number; // seconds of rest for this exercise; falls back to the prefs default
  libId?: string;
}

/** The accents a card's colour field may be drawn from — the palette's five
 * category hues. Paper and ink are excluded: a card must read as a colour. */
export const CARD_HUES = ["clay", "honey", "leaf", "sky", "zest"] as const;
export type CardHue = (typeof CARD_HUES)[number];

export function isCardHue(v: unknown): v is CardHue {
  return typeof v === "string" && (CARD_HUES as readonly string[]).includes(v);
}

export interface Routine {
  id: string;
  name: string;
  position: number;
  /** The workout_program (folder) this routine belongs to. */
  program: string;
  /** A line about what the routine is for — shown on its page. */
  description: string;
  /** The card's colour field. Empty until chosen — the card then falls back to
   * the accent of the muscle the routine trains. */
  hue: CardHue | "";
  /** The doodle you drew for this card. Empty until drawn — the card then
   * falls back to your gym page doodle. */
  emblem: Stroke[];
  items: RoutineItem[];
}

/** A named folder of routines — a training program you own (a split you added
 * from the catalog, or one you built yourself). */
export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  position: number;
}

/** A routine you can start a workout from — a saved Routine, or a template
 * straight out of a program in the catalog. */
export type RoutineTemplate = { id?: string; name: string; items: RoutineItem[] };

/** One logged set. `weight` is reps-seconds for duration exercises; values
 * are what the user typed, in their display unit. */
export interface WorkoutSet {
  weight: number;
  reps: number;
  done: boolean;
}

export interface WorkoutEntry {
  name: string;
  kind: ExerciseKind;
  sets: WorkoutSet[];
  rest?: number; // seconds — this exercise's rest, remembered session to session
  notes?: string;
  libId?: string;
}

export interface Workout {
  id: string;
  title: string;
  routine: string;
  started_at: string; // ISO — the session clock derives from this
  ended_at: string; // "" while live
  paused_at: string; // ISO while paused, "" while running
  paused_ms: number; // banked by pauses already ended
  entries: WorkoutEntry[];
}

/** Total weight moved: Σ weight × reps over completed weighted sets. */
export function workoutVolume(entries: WorkoutEntry[]): number {
  let v = 0;
  for (const e of entries) {
    if (e.kind !== "weight_reps") continue;
    for (const s of e.sets) if (s.done) v += s.weight * s.reps;
  }
  return v;
}

export function workoutSetsDone(entries: WorkoutEntry[]): number {
  return entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

/** Time actually trained, pauses removed. Everything that shows a session's
 * duration reads this — the live clock, the session page, the history card —
 * so a paused break never counts, whether the session is running or filed. */
export function workoutElapsed(w: Workout, now: number): number {
  const start = new Date(w.started_at).getTime();
  const end = w.ended_at ? new Date(w.ended_at).getTime() : w.paused_at ? new Date(w.paused_at).getTime() : now;
  return Math.max(0, end - start - w.paused_ms);
}

/** mm:ss under an hour, h:mm:ss past it — the session clock's face. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Epley one-rep-max estimate — the single yardstick for "did I beat last time?"
 * and for PRs. Rolls weight and reps into one number so heavier *or* more reps
 * both count as progress. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}
