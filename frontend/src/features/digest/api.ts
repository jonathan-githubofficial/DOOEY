import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTasksBetween } from "@/features/tasks/api";
import { liveTrackers, useEntriesRange, useTrackers } from "@/features/trackers/api";
import { useWorkouts } from "@/features/workouts/api";
import { addDays, mondayOf } from "@/lib/dates";
import { pb } from "@/lib/pb";
import { digestOf, type Digest } from "./digest";

/** The week containing `anchor`, Monday to Monday, and the one before it.
 *
 * Every query here is asked for the **fortnight**, not the week: a digest is
 * only ever half about what happened and half about whether that is more or
 * less than last time, and the comparison is computed inside `digestOf` so
 * there is one definition of "last week" rather than one per call site.
 *
 * All the filtering that matters is done in the pure function. These hooks
 * exist to put records in front of it, nothing more. */
export function useWeekDigest(anchor: string): { digest: Digest | null; loading: boolean } {
  const from = mondayOf(anchor);
  const to = addDays(from, 7);
  const fetchFrom = addDays(from, -7);

  const { data: tasks, isPending: tasksPending } = useTasksBetween(fetchFrom, to);
  const { data: entries, isPending: entriesPending } = useEntriesRange(fetchFrom, to);
  // The whole list, and cheap: one person's sessions are a few hundred rows and
  // Gym and Stamps have already asked for them.
  const { data: workouts, isPending: workoutsPending } = useWorkouts();
  const { data: allTrackers } = useTrackers();

  const loading = tasksPending || entriesPending || workoutsPending;

  const digest = useMemo(() => {
    if (loading) return null;
    return digestOf({
      from,
      to,
      tasks: tasks ?? [],
      entries: entries ?? [],
      // Archived on purpose is not the same as quietly dropped, so a tracker
      // you retired never turns up in the week's list of what went quiet.
      trackers: liveTrackers(allTrackers),
      workouts: workouts ?? [],
    });
  }, [loading, from, to, tasks, entries, allTrackers, workouts]);

  return { digest, loading };
}

/** The week in the user's own words.
 *
 * The numbers went out already computed and come back only rearranged into
 * sentences. Nothing about this call can change what the card says a week
 * contained: it is on screen before this fires and stays there if it fails.
 * A mutation rather than a query on purpose — it costs money and it should
 * happen because somebody asked for it. */
export function useNarrateWeek() {
  return useMutation({
    mutationFn: async (digest: Digest) => {
      const res = await pb.send<{ text: string }>("/api/digest/narrate", {
        method: "POST",
        body: { digest },
      });
      return res.text;
    },
  });
}
