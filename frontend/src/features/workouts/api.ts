import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import type { Stroke } from "@/lib/doodle";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import { epley1RM, isCardHue } from "./types";
import type { CardHue, Routine, RoutineItem, RoutineTemplate, Workout, WorkoutEntry, WorkoutProgram, WorkoutSet } from "./types";

export const gymKeys = {
  programs: ["workout_programs"] as const,
  routines: ["routines"] as const,
  workouts: ["workouts"] as const,
  workout: (id: string) => ["workouts", id] as const,
};

function toRoutine(r: RecordModel): Routine {
  return {
    id: r.id,
    name: r.name,
    position: r.position ?? 0,
    program: r.program ?? "",
    description: r.description ?? "",
    hue: isCardHue(r.hue) ? r.hue : "",
    emblem: (r.emblem as Stroke[] | null) ?? [],
    items: (r.items as RoutineItem[] | null) ?? [],
  };
}

function toWorkoutProgram(r: RecordModel): WorkoutProgram {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    position: r.position ?? 0,
  };
}

function toWorkout(r: RecordModel): Workout {
  return {
    id: r.id,
    title: r.title,
    routine: r.routine ?? "",
    started_at: r.started_at,
    ended_at: r.ended_at ?? "",
    paused_at: r.paused_at ?? "",
    paused_ms: r.paused_ms ?? 0,
    entries: (r.entries as WorkoutEntry[] | null) ?? [],
  };
}

export function useRoutines() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: gymKeys.routines,
    enabled: isAuthenticated,
    queryFn: async () => {
      const list = await pb.collection("routines").getFullList({ sort: "position,created" });
      return list.map(toRoutine);
    },
  });
}

export function useWorkoutPrograms() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: gymKeys.programs,
    enabled: isAuthenticated,
    queryFn: async () => {
      const list = await pb.collection("workout_programs").getFullList({ sort: "position,created" });
      return list.map(toWorkoutProgram);
    },
  });
}

/** Recent sessions, newest first — the live one (ended_at empty) rides on top. */
export function useWorkouts() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: gymKeys.workouts,
    enabled: isAuthenticated,
    queryFn: async () => {
      const list = await pb
        .collection("workouts")
        .getList(1, 60, { sort: "-started_at" });
      return list.items.map(toWorkout);
    },
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: gymKeys.workout(id),
    queryFn: async () => toWorkout(await pb.collection("workouts").getOne(id)),
  });
}

export function useSaveRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routine: {
      id?: string;
      name: string;
      items: RoutineItem[];
      description?: string;
      position?: number;
      program?: string;
      hue?: CardHue | "";
      emblem?: Stroke[];
    }) => {
      const owner = useAuthStore.getState().user!.id;
      if (routine.id) {
        return pb.collection("routines").update(routine.id, {
          name: routine.name,
          items: routine.items,
          description: routine.description ?? "",
        });
      }
      return pb.collection("routines").create({
        owner,
        program: routine.program,
        name: routine.name,
        items: routine.items,
        description: routine.description ?? "",
        position: routine.position ?? Date.now(),
        hue: routine.hue ?? "",
        emblem: routine.emblem ?? [],
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: gymKeys.routines }),
  });
}

/** Restyle a routine's card. Kept apart from `useSaveRoutine` so designing a
 * card never rewrites its exercises, and editing exercises never wipes the
 * design. Passing "" / [] returns that half of the card to its automatic
 * fallback. */
export function useDesignRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (design: { id: string; hue?: CardHue | ""; emblem?: Stroke[] }) => {
      const patch: Record<string, unknown> = {};
      if (design.hue !== undefined) patch.hue = design.hue;
      if (design.emblem !== undefined) patch.emblem = design.emblem;
      return pb.collection("routines").update(design.id, patch);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: gymKeys.routines }),
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("routines").delete(id),
    onSettled: () => qc.invalidateQueries({ queryKey: gymKeys.routines }),
  });
}

/** Open a session. From a routine, each exercise arrives with its target
 * number of empty sets — values ghost in from history, not from here. */
export function useStartWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routine: RoutineTemplate | null) => {
      const owner = useAuthStore.getState().user!.id;
      const entries: WorkoutEntry[] = (routine?.items ?? []).map((item) => ({
        name: item.name,
        kind: item.kind,
        libId: item.libId,
        rest: item.rest,
        // Instantiate the prescription: each set opens pre-filled with its target
        // reps (and weight, when the routine sets one), so there's a number to
        // confirm instead of a blank to type. Weight is usually 0 on a routine —
        // the logger fills that in from last time.
        sets: Array.from({ length: Math.max(1, item.sets) }, () => ({
          weight: item.target_weight || 0,
          reps: item.target_reps || 0,
          done: false,
        })),
      }));
      const rec = await pb.collection("workouts").create({
        owner,
        title: routine?.name ?? "Workout",
        routine: routine?.id ?? "",
        started_at: new Date().toISOString(),
        paused_ms: 0,
        entries,
      });
      return toWorkout(rec);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: gymKeys.workouts }),
  });
}

export function useUpdateWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Workout, "title" | "entries" | "ended_at">>) =>
      pb.collection("workouts").update(id, patch),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.workout(id) });
      qc.invalidateQueries({ queryKey: gymKeys.workouts });
    },
  });
}

/** The session in progress, if there is one — at most one workout is ever
 * open, so the live bar and every page that asks read the same record. */
export function useLiveWorkout(): Workout | null {
  const { data } = useWorkouts();
  return data?.find((w) => !w.ended_at) ?? null;
}

/** Pause banks nothing yet; resume folds the pause you just ended into
 * `paused_ms`. Both are timestamps, never counters, so a backgrounded app or
 * a reload picks the clock back up exactly where it was. */
export function useTogglePause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: Workout) =>
      pb
        .collection("workouts")
        .update(
          w.id,
          w.paused_at
            ? { paused_at: "", paused_ms: w.paused_ms + (Date.now() - new Date(w.paused_at).getTime()) }
            : { paused_at: new Date().toISOString() },
        ),
    onSettled: (_d, _e, w) => {
      qc.invalidateQueries({ queryKey: gymKeys.workout(w.id) });
      qc.invalidateQueries({ queryKey: gymKeys.workouts });
    },
  });
}

/** Close a session: drop the sets you never ticked, and bank an open pause so
 * the filed duration matches the clock you were watching. The one writer of
 * `ended_at` — the session page and the live bar both finish through here. */
export function useFinishWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: Workout) => {
      const now = Date.now();
      const kept = w.entries
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0);
      return pb.collection("workouts").update(w.id, {
        entries: kept,
        ended_at: new Date(now).toISOString(),
        paused_at: "",
        paused_ms: w.paused_at ? w.paused_ms + (now - new Date(w.paused_at).getTime()) : w.paused_ms,
      });
    },
    onSettled: (_d, _e, w) => {
      qc.invalidateQueries({ queryKey: gymKeys.workout(w.id) });
      qc.invalidateQueries({ queryKey: gymKeys.workouts });
    },
  });
}

/** Create or rename a program — the named folder its routines live in. */
export function useSaveProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (program: { id?: string; name: string; description?: string }) => {
      const owner = useAuthStore.getState().user!.id;
      if (program.id) {
        return pb.collection("workout_programs").update(program.id, {
          name: program.name,
          description: program.description ?? "",
        });
      }
      return pb.collection("workout_programs").create({
        owner,
        name: program.name,
        description: program.description ?? "",
        position: Date.now(),
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: gymKeys.programs }),
  });
}

/** Delete a program — its routines cascade with it server-side; logged sessions
 * stay in history. */
export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("workout_programs").delete(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.programs });
      qc.invalidateQueries({ queryKey: gymKeys.routines });
    },
  });
}

/** Add a whole program at once: create the folder, then its routines inside it.
 * Seeds the starter split and copies a catalog program into your gym. */
export function useAddProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (program: {
      name: string;
      description: string;
      routines: { name: string; description: string; items: RoutineItem[] }[];
    }) => {
      const owner = useAuthStore.getState().user!.id;
      const rec = await pb.collection("workout_programs").create({
        owner,
        name: program.name,
        description: program.description,
        position: Date.now(),
      });
      const base = Date.now();
      await Promise.all(
        program.routines.map((r, i) =>
          // requestKey: null — these creates hit the same endpoint at once; the
          // SDK auto-cancels same-key requests by default, which would drop all
          // but the last routine. Opt them out so every one lands.
          pb.collection("routines").create(
            {
              owner,
              program: rec.id,
              name: r.name,
              description: r.description,
              items: r.items,
              position: base + i,
            },
            { requestKey: null },
          ),
        ),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.programs });
      qc.invalidateQueries({ queryKey: gymKeys.routines });
    },
  });
}

/** Save a single routine into the catch-all "My Routines" program (created on
 * demand) — cherry-picking one routine out of the catalog. */
export function useSaveLooseRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (routine: { name: string; description: string; items: RoutineItem[] }) => {
      const owner = useAuthStore.getState().user!.id;
      const [existing] = await pb
        .collection("workout_programs")
        .getFullList({ filter: 'name="My Routines"' });
      const program =
        existing ?? (await pb.collection("workout_programs").create({ owner, name: "My Routines", position: 0 }));
      return pb.collection("routines").create({
        owner,
        program: program.id,
        name: routine.name,
        description: routine.description,
        items: routine.items,
        position: Date.now(),
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: gymKeys.programs });
      qc.invalidateQueries({ queryKey: gymKeys.routines });
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("workouts").delete(id),
    onSettled: () => qc.invalidateQueries({ queryKey: gymKeys.workouts }),
  });
}

export function emptySet(): WorkoutSet {
  return { weight: 0, reps: 0, done: false };
}

/** What you lifted last time, per exercise name — the ghost values that make
 * logging two taps instead of typing. Derived from finished sessions, newest
 * first; a client-side scan is nothing at one user's scale.
 *
 * A ticked set that recorded neither weight nor reps is not a reference, it is
 * a stray tap, and offering "0×0" as last time's numbers is worse than
 * offering nothing. Weight alone can legitimately be zero — that is every
 * bodyweight movement — so it takes both being empty to disqualify a set. */
export function previousLookup(workouts: Workout[]): Map<string, WorkoutSet[]> {
  const map = new Map<string, WorkoutSet[]>();
  for (const w of workouts) {
    if (!w.ended_at) continue;
    for (const e of w.entries) {
      if (map.has(e.name)) continue;
      const done = e.sets.filter((s) => s.done && (s.reps > 0 || s.weight > 0));
      if (done.length > 0) map.set(e.name, done);
    }
  }
  return map;
}

/** Last time's set to hold this one against.
 *
 * Positional, but *clamped* — if you did three sets last time and five today,
 * sets four and five are measured against the third rather than against
 * nothing. The alternative is a column of em-dashes exactly where the session
 * gets hard, which is when you most want to know what you did before. Finished
 * sessions are also pruned of un-ticked sets, so last time's list is usually
 * shorter than today's and this is the common case, not the edge. */
export function ghostSet(sets: WorkoutSet[] | undefined, index: number): WorkoutSet | undefined {
  if (!sets || sets.length === 0) return undefined;
  return sets[Math.min(index, sets.length - 1)];
}

/** The rest you last used per exercise — memory so you don't re-set it. */
export function restLookup(workouts: Workout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of workouts) {
    for (const e of w.entries) {
      if (!map.has(e.name) && typeof e.rest === "number") map.set(e.name, e.rest);
    }
  }
  return map;
}

export interface ExerciseRecord {
  weight: number; // heaviest single set
  oneRM: number; // best estimated 1RM — the PR yardstick
  volume: number; // best single-set weight × reps
}

/** Which sessions set a personal best *when they happened*. `personalRecords`
 * can't answer this — it folds in the session you're asking about — so this
 * walks oldest→newest and measures each set against the record standing before
 * it. The first time you ever do an exercise doesn't count; otherwise every new
 * movement would stamp a PR. */
export function prSessions(workouts: Workout[]): Set<string> {
  const best = new Map<string, number>();
  const hits = new Set<string>();
  const oldestFirst = workouts
    .filter((w) => w.ended_at)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  for (const w of oldestFirst) {
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (!s.done) continue;
        const rm = epley1RM(s.weight, s.reps);
        if (rm <= 0) continue;
        const prev = best.get(e.name);
        if (prev === undefined) best.set(e.name, rm);
        else if (rm > prev) {
          hits.add(w.id);
          best.set(e.name, rm);
        }
      }
    }
  }
  return hits;
}

/** Personal bests per exercise, from finished sessions — what a new set has to
 * beat to earn a PR. Client-side scan, same as the memory lookups. */
export function personalRecords(workouts: Workout[]): Map<string, ExerciseRecord> {
  const map = new Map<string, ExerciseRecord>();
  for (const w of workouts) {
    if (!w.ended_at) continue;
    for (const e of w.entries) {
      for (const s of e.sets) {
        if (!s.done) continue;
        const cur = map.get(e.name) ?? { weight: 0, oneRM: 0, volume: 0 };
        map.set(e.name, {
          weight: Math.max(cur.weight, s.weight),
          oneRM: Math.max(cur.oneRM, epley1RM(s.weight, s.reps)),
          volume: Math.max(cur.volume, s.weight * s.reps),
        });
      }
    }
  }
  return map;
}

