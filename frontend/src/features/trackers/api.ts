import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { RecordModel } from "pocketbase";
import { isCardHue, type CardHue } from "@/features/workouts/types";
import { addDays } from "@/lib/dates";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import { defaultsFor, isShape, slugify, type Entry, type Shape, type Tracker, type TrackerPatch } from "./types";

export const trackerKeys = {
  all: ["trackers"] as const,
  entriesDay: (date: string) => ["entries", date] as const,
};

function toTracker(r: RecordModel): Tracker {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    // A row written by a future version, or by hand, degrades to words rather
    // than rendering a control that doesn't exist.
    shape: isShape(r.shape) ? r.shape : "text",
    unit: r.unit ?? "",
    min: r.min ?? 0,
    max: r.max ?? 0,
    hue: isCardHue(r.hue) ? r.hue : "zest",
    position: r.position ?? 0,
    archived: !!r.archived,
  };
}

function toEntry(r: RecordModel): Entry {
  return { id: r.id, tracker: r.tracker, at: r.at, body: r.body ?? "", value: r.value ?? 0 };
}

/** Everything you track, archived included, in the order you arranged them.
 * One list rather than two hooks: the Stamps strip wants the live ones and the
 * editor wants all of them, and that is a `.filter`, not a second query. */
export function useTrackers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: trackerKeys.all,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("trackers").getFullList({ sort: "position,created" });
      return records.map(toTracker);
    },
  });
}

/** The ones still being kept. */
export const liveTrackers = (all: Tracker[] | undefined): Tracker[] =>
  (all ?? []).filter((t) => !t.archived);

/** A day's entries across every tracker, oldest first.
 *
 * One query serves the whole day: the Stamps page groups it by tracker and each
 * ritual slot filters it to its own band. `at` is a real instant, so the day is
 * a half-open window rather than a prefix match, which is what keeps last
 * night's supper out of this morning across timezones. */
export function useEntriesDay(date: string, wanted = true) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: trackerKeys.entriesDay(date),
    // The week grid mounts seven of these; `wanted` keeps the days with no
    // slots on them from asking.
    enabled: isAuthenticated && wanted,
    queryFn: async () => {
      const records = await pb.collection("entries").getFullList({
        filter: pb.filter("at >= {:from} && at < {:to}", {
          from: new Date(`${date}T00:00:00`),
          to: new Date(`${addDays(date, 1)}T00:00:00`),
        }),
        sort: "at",
      });
      return records.map(toEntry);
    },
  });
}

/** Every entry between two local dates, oldest first — what the album is built
 * from. One query for the whole grid rather than one per day: six months of
 * per-day queries is 180 round trips to draw one page. */
export function useEntriesRange(from: string, to: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["entries", "range", from, to] as const,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("entries").getFullList({
        filter: pb.filter("at >= {:from} && at < {:to}", {
          from: new Date(`${from}T00:00:00`),
          to: new Date(`${to}T00:00:00`),
        }),
        sort: "at",
      });
      return records.map(toEntry);
    },
  });
}

/** The last thing logged against a tracker, ever.
 *
 * This is what stops the app opening an empty number field. Correcting 78 to
 * 78.4 is faster than typing either, and it reads as the app having paid
 * attention. Null while loading and when there is genuinely no history. */
export function useLastEntry(trackerId: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["entries", "last", trackerId],
    enabled: isAuthenticated && !!trackerId,
    queryFn: async () => {
      const found = await pb.collection("entries").getList(1, 1, {
        filter: pb.filter("tracker = {:id}", { id: trackerId }),
        sort: "-at",
      });
      return found.items.length > 0 ? toEntry(found.items[0]) : null;
    },
  });
}

export interface NewTracker {
  name: string;
  shape: Shape;
  hue: CardHue;
  unit?: string;
  min?: number;
  max?: number;
}

export function useCreateTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: NewTracker) => {
      const existing = qc.getQueryData<Tracker[]>(trackerKeys.all) ?? [];
      const shape = defaultsFor(next.shape);
      return pb.collection("trackers").create({
        owner: useAuthStore.getState().user!.id,
        name: next.name,
        slug: slugify(next.name, existing.map((t) => t.slug)),
        shape: next.shape,
        unit: next.unit ?? shape.unit,
        min: next.min ?? shape.min,
        max: next.max ?? shape.max,
        hue: next.hue,
        position: existing.length,
        archived: false,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: trackerKeys.all }),
  });
}

export function usePatchTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TrackerPatch }) =>
      pb.collection("trackers").update(id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: trackerKeys.all }),
  });
}

/** Takes the tracker's entries with it — the collection cascades. Archiving is
 * how you stop tracking something and keep what you logged. */
export function useDeleteTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("trackers").delete(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: trackerKeys.all });
      qc.invalidateQueries({ queryKey: ENTRIES });
    },
  });
}

export interface NewEntry {
  tracker: string;
  body?: string;
  value?: number;
  /** Defaults to now. Passed when something else knows better: a ritual slot
   * being answered late, or a ramble that said "at seven". */
  at?: Date;
}

/** One entry lands in three caches: the day it belongs to, whatever ranges the
 * album is holding, and the tracker's last value. They all hang off `entries`,
 * so the prefix is the invalidation — a hook taking a date just to name one of
 * the three would leave the other two stale. */
const ENTRIES = ["entries"] as const;

export function useAddEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: NewEntry) =>
      pb.collection("entries").create({
        owner: useAuthStore.getState().user!.id,
        tracker: next.tracker,
        body: next.body ?? "",
        value: next.value ?? 0,
        // Now, not midnight: the time beside an entry is half the point of it.
        at: (next.at ?? new Date()).toISOString(),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: ENTRIES }),
  });
}

export function useEditEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; body?: string; value?: number }) =>
      pb.collection("entries").update(id, patch),
    onSettled: () => qc.invalidateQueries({ queryKey: ENTRIES }),
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("entries").delete(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ENTRIES }),
  });
}

/** The one tracker a new account starts with, so the page has something to be
 * on the first morning. Everything else is theirs to add. */
const FIRST: NewTracker = { name: "Food", shape: "text", hue: "honey" };

/** Lays down that first tracker the once. Mounted where trackers are shown,
 * the same way Projects materializes a pushed program: an empty list is only
 * empty after it has actually loaded, so this waits for the query. */
export function useSeedTrackers(trackers: Tracker[] | undefined) {
  const create = useCreateTracker();
  const seeded = trackers !== undefined && trackers.length === 0;
  const idle = create.isIdle;
  useEffect(() => {
    if (seeded && idle) create.mutate(FIRST);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, idle]);
}
