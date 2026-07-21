import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { addDays, localDate, nextMonth } from "@/lib/dates";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import type { Task, TaskPatch } from "./types";

export const taskKeys = {
  all: ["tasks"] as const,
  day: (date: string) => ["tasks", "day", date] as const,
};

function toTask(r: RecordModel): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    due_date: r.due_date ?? "",
    done_at: r.done_at ?? "",
    sort_order: r.sort_order ?? 0,
    start_min: r.start_min ?? 0,
    dur_min: r.dur_min || 60,
    project: r.project ?? "",
    gate: r.gate ?? false,
    created: r.created,
  };
}

/** One agenda day. Today additionally carries undated + overdue open tasks;
 * every day shows tasks due that day plus tasks completed that day. */
export function useDayTasks(date: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: taskKeys.day(date),
    enabled: isAuthenticated,
    queryFn: async () => {
      // due_date is stored at 00:00Z with date-only meaning → date-string bounds;
      // done_at is a real instant → local-day bounds.
      const dueStart = new Date(`${date}T00:00:00.000Z`);
      const dueEnd = new Date(`${addDays(date, 1)}T00:00:00.000Z`);
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${addDays(date, 1)}T00:00:00`);
      const filter =
        date === localDate()
          ? pb.filter(
              "(done_at = '' && (due_date = '' || due_date < {:dueEnd})) || done_at >= {:dayStart}",
              { dueEnd, dayStart },
            )
          : pb.filter(
              "(due_date >= {:dueStart} && due_date < {:dueEnd}) || (done_at >= {:dayStart} && done_at < {:dayEnd})",
              { dueStart, dueEnd, dayStart, dayEnd },
            );
      const records = await pb.collection("tasks").getFullList({ filter, sort: "sort_order,created" });
      return records.map(toTask);
    },
  });
}

/** Open-task counts per day for one month ("YYYY-MM") — the month grid's dots. */
export function useMonthOpenCounts(month: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["tasks", "monthCounts", month] as const,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("tasks").getFullList({
        filter: pb.filter("done_at = '' && due_date >= {:start} && due_date < {:end}", {
          start: new Date(`${month}-01T00:00:00.000Z`),
          end: new Date(`${nextMonth(month)}-01T00:00:00.000Z`),
        }),
        fields: "due_date",
      });
      const counts: Record<string, number> = {};
      for (const r of records) {
        const d = (r.due_date as string).slice(0, 10);
        counts[d] = (counts[d] ?? 0) + 1;
      }
      return counts;
    },
  });
}

// requestKey: null on all mutations — the SDK auto-cancels same-key requests,
// and two quick writes to one record must both land, not race.

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      title,
      description,
      notes,
      due_date,
      start_min,
      dur_min,
    }: {
      title: string;
      description?: string;
      notes?: string;
      due_date?: string;
      start_min?: number;
      dur_min?: number;
    }) =>
      pb.collection("tasks").create(
        {
          owner: pb.authStore.record!.id,
          title,
          description: description ?? "",
          notes: notes ?? "",
          due_date: due_date ?? "",
          start_min: start_min ?? 0,
          dur_min: dur_min ?? 60,
          sort_order: Date.now(),
        },
        { requestKey: null },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskPatch }) =>
      pb.collection("tasks").update(id, patch, { requestKey: null }),
    // Optimistic: checking a task off must feel instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const snaps = qc.getQueriesData<Task[]>({ queryKey: taskKeys.all });
      qc.setQueriesData<Task[]>({ queryKey: taskKeys.all }, (ts) =>
        ts?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { snaps };
    },
    onError: (_e, _v, ctx) =>
      ctx?.snaps.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("tasks").delete(id, { requestKey: null }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const snaps = qc.getQueriesData<Task[]>({ queryKey: taskKeys.all });
      qc.setQueriesData<Task[]>({ queryKey: taskKeys.all }, (ts) =>
        ts?.filter((t) => t.id !== id),
      );
      return { snaps };
    },
    onError: (_e, _v, ctx) =>
      ctx?.snaps.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
