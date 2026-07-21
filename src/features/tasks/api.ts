import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { nextMonth, pad2 } from "@/lib/date";
import { useCollectionLive } from "@/lib/useCollectionLive";
import { useAuthStore } from "@/stores";
import { addDays, localDate, weekOf } from "./dates";
import { SNAP } from "./timeGrid";
import type { AgendaExternal, Task, TaskPatch } from "./types";

export { localDate };

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
  const qc = useQueryClient();
  useCollectionLive("tasks", () => qc.invalidateQueries({ queryKey: taskKeys.all }));
}

// ── Google Calendar events (read-only, unit 5.3) ────────────────────────────
// Foreign events live in the server-only `calendar_events` collection (populated by
// pb_hooks/calendar-sync.js; createRule/updateRule/deleteRule = null). The client only READS them
// (listRule = owner) and folds them into the planner via the AgendaExternal seam — no schedule
// handlers, so the grids treat them as non-draggable, read-only rows (architecture: "foreign
// events ... render read-only in Today"). No write path can reach the collection.

export const eventKeys = {
  all: ["events"] as const,
  day: (date: string) => ["events", "day", date] as const,
  week: (anchor: string) => ["events", "week", anchor] as const,
};

/** The browser-local day (YYYY-MM-DD) a stored-UTC instant falls on — the app's "a day" unit. */
function eventDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** A calendar_events record → a read-only AgendaExternal. start_at/end_at are stored UTC; the
 * planner reasons in browser-local time (dates.localDate / TimeboxSheet.useNowMinutes), so the
 * start maps to local minutes-from-midnight. INERT: onToggle/onSort are no-ops and there are no
 * schedule handlers, so it is never draggable and never written back. */
function toEvent(r: RecordModel): AgendaExternal {
  const start = new Date(r.start_at);
  const end = new Date(r.end_at);
  const startMin = start.getHours() * 60 + start.getMinutes(); // browser-local
  const durMin = Math.max(SNAP, Math.round((end.getTime() - start.getTime()) / 60000));
  return {
    id: r.id,
    sort: startMin,
    done: false,
    title: r.title || "(busy)",
    subtitle: undefined,
    accentClass: "bg-sky", // foreign = blue hue (token --sky, kept per crib)
    to: "/calendar", // events have no detail page
    params: {},
    onToggle: () => {}, // read-only
    onSort: () => {}, // read-only
    startMin: startMin > 0 ? startMin : undefined, // all-day (midnight) → list-only, off the timed grid
    durMin,
  };
}

/** Read-only Google events overlapping one local day, as AgendaExternal rows (interleaves with
 * the day's tasks by `sort` = start minutes). */
export function useDayEvents(date: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: eventKeys.day(date),
    enabled: isAuthenticated,
    queryFn: async () => {
      // start_at/end_at are real UTC instants → local-day bounds (cf. useDayTasks' done_at). An
      // event overlaps the day when it starts before the day ends and ends after the day starts.
      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${addDays(date, 1)}T00:00:00`);
      const records = await pb.collection("calendar_events").getFullList({
        filter: pb.filter("start_at < {:dayEnd} && end_at > {:dayStart}", { dayStart, dayEnd }),
        sort: "start_at",
        // Distinct auto-cancel key: the SDK keys cancellation on method+path (query params excluded),
        // so this day query and the week query below would otherwise cancel each other when both fire
        // from the same render (Calendar mounts both). A per-query key keeps them independent.
        requestKey: `events-day-${date}`,
      });
      // Keep only events whose local start day IS this day (guards tz edges: a multi-day/overlap
      // event shows on its start day, matching the single-day planner semantics).
      return records.filter((r) => eventDay(r.start_at) === date).map(toEvent);
    },
  });
}

/** Read-only Google events across the week containing `anchor`, grouped by browser-local day →
 * the WeekGrid's externsByDay map. One query for the seven-day UTC range (preferred over 7 hooks;
 * mirrors the useDayTasks filter shape). */
export function useWeekEvents(anchor: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: eventKeys.week(anchor),
    enabled: isAuthenticated,
    queryFn: async () => {
      const week = weekOf(anchor);
      const dayStart = new Date(`${week[0]}T00:00:00`);
      const dayEnd = new Date(`${addDays(week[6], 1)}T00:00:00`);
      const records = await pb.collection("calendar_events").getFullList({
        filter: pb.filter("start_at < {:dayEnd} && end_at > {:dayStart}", { dayStart, dayEnd }),
        sort: "start_at",
        // Distinct auto-cancel key (see useDayEvents): keeps this week query from cancelling — or
        // being cancelled by — the day query that fires from the same Calendar render.
        requestKey: `events-week-${anchor}`,
      });
      const byDay: Record<string, AgendaExternal[]> = {};
      for (const r of records) (byDay[eventDay(r.start_at)] ??= []).push(toEvent(r));
      return byDay;
    },
  });
}

/** Live-follow calendar_events; any change refreshes every events query (parity with useTasksLive;
 * realtime via SSE — listRule lets the owner subscribe). */
export function useCalendarEventsLive() {
  const qc = useQueryClient();
  useCollectionLive("calendar_events", () => qc.invalidateQueries({ queryKey: eventKeys.all }));
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
