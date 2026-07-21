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
  libId?: string;
}

export interface Routine {
  id: string;
  name: string;
  position: number;
  /** The plan this routine belongs to — "Push", "Legs"… — or "" for loose. */
  group: string;
  items: RoutineItem[];
}

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
  libId?: string;
}

export interface Workout {
  id: string;
  title: string;
  routine: string;
  started_at: string; // ISO — the session clock derives from this
  ended_at: string; // "" while live
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

/** mm:ss under an hour, h:mm:ss past it — the session clock's face. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
