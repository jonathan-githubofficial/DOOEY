import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import type { Routine, RoutineItem, Workout, WorkoutEntry, WorkoutSet } from "./types";

export const gymKeys = {
  routines: ["routines"] as const,
  workouts: ["workouts"] as const,
  workout: (id: string) => ["workouts", id] as const,
};

function toRoutine(r: RecordModel): Routine {
  return {
    id: r.id,
    name: r.name,
    position: r.position ?? 0,
    group: r.group ?? "",
    items: (r.items as RoutineItem[] | null) ?? [],
  };
}

function toWorkout(r: RecordModel): Workout {
  return {
    id: r.id,
    title: r.title,
    routine: r.routine ?? "",
    started_at: r.started_at,
    ended_at: r.ended_at ?? "",
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
      group?: string;
      position?: number;
    }) => {
      const owner = useAuthStore.getState().user!.id;
      if (routine.id) {
        return pb.collection("routines").update(routine.id, {
          name: routine.name,
          items: routine.items,
          group: routine.group ?? "",
        });
      }
      return pb.collection("routines").create({
        owner,
        name: routine.name,
        items: routine.items,
        group: routine.group ?? "",
        position: routine.position ?? 0,
      });
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
    mutationFn: async (routine: Routine | null) => {
      const owner = useAuthStore.getState().user!.id;
      const entries: WorkoutEntry[] = (routine?.items ?? []).map((item) => ({
        name: item.name,
        kind: item.kind,
        libId: item.libId,
        sets: Array.from({ length: Math.max(1, item.sets) }, () => emptySet()),
      }));
      const rec = await pb.collection("workouts").create({
        owner,
        title: routine?.name ?? "Workout",
        routine: routine?.id ?? "",
        started_at: new Date().toISOString(),
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
 * first; a client-side scan is nothing at one user's scale. */
export function previousLookup(workouts: Workout[]): Map<string, WorkoutSet[]> {
  const map = new Map<string, WorkoutSet[]>();
  for (const w of workouts) {
    if (!w.ended_at) continue;
    for (const e of w.entries) {
      if (map.has(e.name)) continue;
      const done = e.sets.filter((s) => s.done);
      if (done.length > 0) map.set(e.name, done);
    }
  }
  return map;
}

