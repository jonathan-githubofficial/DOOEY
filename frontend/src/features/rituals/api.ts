import { useMemo } from "react";
import { useJournalDay } from "@/features/journal/api";
import { useRoutines, useWorkouts } from "@/features/workouts/api";
import {
  formatElapsed,
  workoutElapsed,
  workoutSetsDone,
  type Routine,
  type Workout,
} from "@/features/workouts/types";
import { useNowMinutes } from "@/lib/clock";
import { localDate, localDateOf } from "@/lib/dates";
import { minutesOfDay, occurrencesFor } from "./schedule";
import { useRituals } from "./store";
import type { Occurrence } from "./types";

/** What became of a slot.
 *
 * Nothing here is stored: `kept` is a workout that happened, `live` is a
 * session still open, `missed` is a band the clock has run past with nothing
 * in it. Delete the workout and the slot goes back to being missed, which is
 * the point of deriving it. */
export type SlotState = "kept" | "live" | "due" | "upcoming" | "missed";

export interface DayRitual extends Occurrence {
  state: SlotState;
  /** The session that filled this slot — open it, or resume it when live. */
  workoutId: string;
  /** One line about what happened, or what is meant to. */
  note: string;
  /** The routine behind a gym slot, for its colour, emblem and length. */
  routine: Routine | null;
}

/** Only ever called on a session that has ended, so `workoutElapsed` reads
 * `ended_at` and the "now" argument is never consulted. Passing 0 keeps the
 * clock out of render. */
function summarize(w: Workout): string {
  const sets = workoutSetsDone(w.entries);
  const time = formatElapsed(workoutElapsed(w, 0));
  return sets > 0 ? `${sets} sets · ${time}` : time;
}

/** The day's ritual slots, each resolved against what actually happened.
 *
 * Reads three sources and joins them in memory rather than asking the server a
 * fourth question: the schedule (local), recent sessions (already cached for
 * the gym space and the live bar) and the day's journal entries. */
export function useDayRituals(date: string): DayRitual[] {
  const rituals = useRituals();
  const occurrences = useMemo(() => occurrencesFor(date, rituals), [date, rituals]);

  const wantsGym = occurrences.some((o) => o.ritual.kind === "gym");
  const wantsJournal = occurrences.some((o) => o.ritual.kind === "journal");

  const { data: workouts } = useWorkouts();
  const { data: routines } = useRoutines();
  // Only asked for when a meal slot actually falls on this day — the week grid
  // mounts seven of these at once.
  const { data: entries } = useJournalDay(date, wantsJournal);

  const isToday = date === localDate();
  const nowMin = useNowMinutes(isToday);

  return useMemo(() => {
    const dayWorkouts = wantsGym
      ? (workouts ?? []).filter((w) => localDateOf(w.started_at) === date)
      : [];
    const byRoutine = new Map((routines ?? []).map((r) => [r.id, r]));

    return occurrences.map((o) => {
      const { kind } = o.ritual;
      const routine = kind === "gym" ? (byRoutine.get(o.ritual.ref) ?? null) : null;
      // A ritual pointing at a deleted routine falls back to "any training"
      // rather than becoming permanently unkeepable.
      const ref = routine ? o.ritual.ref : "";

      // A session counts for the slot whose band it started in; a ritual with
      // no routine picked yet is answered by any training that day.
      const filled =
        kind === "gym"
          ? dayWorkouts.find((w) => {
              if (ref && w.routine !== ref) return false;
              const m = minutesOfDay(w.started_at);
              return m >= o.from_min && m < o.to_min;
            })
          : undefined;
      const entry =
        kind === "journal"
          ? (entries ?? []).find((e) => {
              const m = minutesOfDay(e.eaten_at);
              return m >= o.from_min && m < o.to_min;
            })
          : undefined;

      let state: SlotState;
      let note: string;
      if (filled && !filled.ended_at) {
        state = "live";
        note = "In progress";
      } else if (filled) {
        state = "kept";
        note = summarize(filled);
      } else if (entry) {
        state = "kept";
        note = entry.body;
      } else if (nowMin === null) {
        // Not today: the past is missed, the future is still to come.
        state = date < localDate() ? "missed" : "upcoming";
        note = plan(o, routine);
      } else if (nowMin < o.start_min) {
        state = "upcoming";
        note = plan(o, routine);
      } else if (nowMin < o.to_min) {
        state = "due";
        note = plan(o, routine);
      } else {
        state = "missed";
        note = plan(o, routine);
      }

      return { ...o, state, note, workoutId: filled?.id ?? "", routine };
    });
  }, [occurrences, workouts, routines, entries, date, nowMin, wantsGym]);
}

/** What the slot is *for*, shown until something fills it. */
function plan(o: Occurrence, routine: Routine | null): string {
  if (o.ritual.kind === "journal") {
    return o.count > 1 ? `Meal ${o.index} of ${o.count}` : "Write down what you ate";
  }
  if (!routine) return "Any session counts";
  const n = routine.items.length;
  return `${n} ${n === 1 ? "exercise" : "exercises"}`;
}
