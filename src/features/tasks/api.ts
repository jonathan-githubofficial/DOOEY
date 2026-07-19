import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores";
import { addDays } from "./dates";
import type { Task, TaskPatch } from "./types";

export const taskKeys = {
  all: ["tasks"] as const,
  days: ["tasks", "day"] as const,
  day: (date: string) => ["tasks", "day", date] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
};

function toTask(r: RecordModel): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    due_date: r.due_date ?? "",
    done_at: r.done_at ?? "",
    notes: r.notes ?? "",
    checklist: r.checklist ?? [],
    resources: r.resources ?? [],
    attachments: r.attachments ?? [],
    doodle: r.doodle ?? [],
    decor: r.decor ?? [],
    decor_photos: r.decor_photos ?? [],
    sort_order: r.sort_order ?? 0,
    start_min: r.start_min ?? 0,
    dur_min: r.dur_min || 60,
    board: r.board ?? "",
    project: r.project ?? "",
    gate: r.gate ?? false,
    session_key: r.session_key ?? "",
    created: r.created,
  };
}

/** Today's local date as YYYY-MM-DD (browser timezone), offset by whole days. */
export function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
      const [y, m] = month.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      const records = await pb.collection("tasks").getFullList({
        filter: pb.filter("done_at = '' && due_date >= {:start} && due_date < {:end}", {
          start: new Date(`${month}-01T00:00:00.000Z`),
          end: new Date(`${next}-01T00:00:00.000Z`),
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

/** Every task belonging to one project (program), across all dates — the
 * project detail list and the folder-card metrics read from this. */
export function useProjectTasks(projectId: string | undefined) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["tasks", "project", projectId ?? ""] as const,
    enabled: isAuthenticated && !!projectId,
    queryFn: async () => {
      const records = await pb.collection("tasks").getFullList({
        filter: pb.filter("project = {:id}", { id: projectId }),
        sort: "due_date,sort_order,created",
      });
      return records.map(toTask);
    },
  });
}

export function useTask(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: taskKeys.detail(id),
    enabled: isAuthenticated,
    queryFn: async () => toTask(await pb.collection("tasks").getOne(id)),
  });
}

/** Live-follow the tasks collection; any change refreshes every tasks query. */
export function useTasksLive() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const qc = useQueryClient();
  useEffect(() => {
    if (!isAuthenticated) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    pb.collection("tasks")
      .subscribe("*", () => qc.invalidateQueries({ queryKey: taskKeys.all }))
      .then((u) => {
        if (cancelled) u();
        else unsub = u;
      })
      .catch(() => {}); // SSE is a refresh channel, not a data dependency
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isAuthenticated, qc]);
}

// ── optimistic-cache plumbing ──────────────────────────────────────────────
type DaySnapshots = [readonly unknown[], Task[] | undefined][];

function patchDayCaches(qc: QueryClient, map: (t: Task) => Task | null): DaySnapshots {
  const snaps = qc.getQueriesData<Task[]>({ queryKey: taskKeys.days });
  qc.setQueriesData<Task[]>({ queryKey: taskKeys.days }, (ts) =>
    ts?.flatMap((t) => {
      const next = map(t);
      return next ? [next] : [];
    }),
  );
  return snaps;
}

function restoreDayCaches(qc: QueryClient, snaps: DaySnapshots | undefined) {
  snaps?.forEach(([key, data]) => qc.setQueryData(key, data));
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
      project,
    }: {
      title: string;
      description?: string;
      notes?: string;
      due_date?: string;
      start_min?: number;
      dur_min?: number;
      project?: string;
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
          project: project ?? "",
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
    // Optimistic: agenda edits (check-off, reorder, page edits) must feel instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      const snaps = patchDayCaches(qc, (t) => (t.id === id ? { ...t, ...patch } : t));
      const prevDetail = qc.getQueryData<Task>(taskKeys.detail(id));
      qc.setQueryData<Task>(taskKeys.detail(id), (t) => (t ? { ...t, ...patch } : t));
      return { snaps, prevDetail, id };
    },
    onError: (_e, _v, ctx) => {
      restoreDayCaches(qc, ctx?.snaps);
      if (ctx) qc.setQueryData(taskKeys.detail(ctx.id), ctx.prevDetail);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("tasks").delete(id, { requestKey: null }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: taskKeys.all });
      return { snaps: patchDayCaches(qc, (t) => (t.id === id ? null : t)) };
    },
    onError: (_e, _v, ctx) => restoreDayCaches(qc, ctx?.snaps),
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

/** Add or remove attachment files (PB `field+` / `field-` modifiers). */
export function useUpdateAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, add, remove }: { id: string; add?: File[]; remove?: string }) =>
      pb.collection("tasks").update(
        id,
        {
          ...(add ? { "attachments+": add } : {}),
          ...(remove ? { "attachments-": remove } : {}),
        },
        { requestKey: null },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function attachmentUrl(taskId: string, filename: string): string {
  return `${pb.baseURL}/api/files/tasks/${taskId}/${encodeURIComponent(filename)}`;
}
