import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateTask } from "@/features/tasks/api";
import { liveTrackers, trackerKeys, useTrackers } from "@/features/trackers/api";
import type { Tracker } from "@/features/trackers/types";
import { pad2 } from "@/lib/dates";
import { pb } from "@/lib/pb";
import { dayKeyOf, entryAtFrom, taskParamsFrom } from "./commit";
import type { DraftEntity, ParseResponse } from "./types";

/** What the parse route needs to know about a tracker to route speech into it:
 * the slug it must answer with, the name the speaker actually says, and enough
 * of the shape to know whether a number is expected. */
function brief(tracker: Tracker) {
  return {
    slug: tracker.slug,
    name: tracker.name,
    shape: tracker.shape,
    unit: tracker.unit,
    max: tracker.max,
  };
}

/** One debounced re-parse: the whole transcript out, the whole intended state
 * back. The pb_hooks route holds the provider key; the app never talks to the
 * model directly.
 *
 * The trackers go with it because the route will not invent one: what the user
 * has decided to keep is the only vocabulary it may route into, so adding a
 * tracker is also how you teach the rambler a new word. */
export function parseRamble(
  transcript: string,
  rev: number,
  trackers: Tracker[],
): Promise<ParseResponse> {
  const d = new Date();
  // The prompt resolves "tomorrow" and "tonight" against this stamp.
  const now = `${d.toLocaleDateString("en", { weekday: "long" })} ${dayKeyOf(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return pb.send<ParseResponse>("/api/rambler/parse", {
    method: "POST",
    body: { transcript, rev, now, trackers: trackers.map(brief) },
  });
}

/** The trackers a ramble may be routed into. */
export function useRambleTrackers(): Tracker[] {
  const { data } = useTrackers();
  return liveTrackers(data);
}

/** Files the confirmed draft: tasks through the tasks feature's own create
 * (which invalidates its caches), entries straight into `entries` under the
 * tracker they were spoken against. */
export function useCommitDraft() {
  const qc = useQueryClient();
  const createTask = useCreateTask();
  const trackers = useRambleTrackers();

  return useMutation({
    mutationFn: async (entities: DraftEntity[]) => {
      const now = new Date();
      const bySlug = new Map(trackers.map((t) => [t.slug, t]));
      for (const entity of entities) {
        if (entity.kind === "task") {
          await createTask.mutateAsync(taskParamsFrom(entity, now));
          continue;
        }
        // A tracker deleted between the parse and the stamp has nothing to
        // file against; the rest of the draft still lands.
        const tracker = bySlug.get(entity.tracker);
        if (!tracker) continue;
        await pb.collection("entries").create(
          {
            owner: pb.authStore.record!.id,
            tracker: tracker.id,
            body: entity.body,
            value: entity.value ?? 0,
            at: entryAtFrom(entity, now).toISOString(),
          },
          { requestKey: null },
        );
      }
      return { entities, now };
    },
    onSuccess: ({ entities, now }) => {
      for (const entity of entities) {
        if (entity.kind === "entry") {
          qc.invalidateQueries({
            queryKey: trackerKeys.entriesDay(dayKeyOf(entryAtFrom(entity, now))),
          });
        }
      }
      // Every composer seeds from the last entry, and some of those just moved.
      qc.invalidateQueries({ queryKey: ["entries", "last"] });
    },
  });
}
