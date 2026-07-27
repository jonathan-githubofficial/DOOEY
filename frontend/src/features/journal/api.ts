import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { addDays } from "@/lib/dates";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import type { JournalEntry } from "./types";

export const journalKeys = {
  day: (date: string) => ["journal", date] as const,
};

function toEntry(r: RecordModel): JournalEntry {
  return { id: r.id, kind: "food", body: r.body, eaten_at: r.eaten_at };
}

/** A day's entries, oldest first — the order you ate them in.
 *
 * `eaten_at` is a real timestamp, so a day is a half-open window rather than a
 * prefix match: anything from local midnight up to (not including) the next.
 * That's what keeps yesterday's supper out of today's list across timezones. */
export function useJournalDay(date: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: journalKeys.day(date),
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("journal_entries").getFullList({
        filter: pb.filter("kind = 'food' && eaten_at >= {:from} && eaten_at < {:to}", {
          from: new Date(`${date}T00:00:00`),
          to: new Date(`${addDays(date, 1)}T00:00:00`),
        }),
        sort: "eaten_at",
      });
      return records.map(toEntry);
    },
  });
}

export function useAddEntry(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      pb.collection("journal_entries").create({
        owner: useAuthStore.getState().user!.id,
        kind: "food",
        body,
        // Now, not midnight — the timestamp beside an entry is the point of it.
        eaten_at: new Date().toISOString(),
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.day(date) }),
  });
}

export function useEditEntry(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      pb.collection("journal_entries").update(id, { body }),
    onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.day(date) }),
  });
}

export function useDeleteEntry(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("journal_entries").delete(id),
    onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.day(date) }),
  });
}
