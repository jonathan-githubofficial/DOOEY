import { useMemo } from "react";
import { useEntriesDay, useTrackers } from "@/features/trackers/api";
import { formatValue, type Entry, type Tracker } from "@/features/trackers/types";
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
  /** The routine behind a training slot, for its colour, emblem and length. */
  routine: Routine | null;
  /** The tracker behind a tracker slot, for its colour and how its entries read
   * back. Null when the ritual has not been pointed at one yet, which means
   * anything logged in the band answers it. */
  tracker: Tracker | null;
}

/** Only ever called on a session that has ended, so `workoutElapsed` reads
 * `ended_at` and the "now" argument is never consulted. Passing 0 keeps the
 * clock out of render. */
function summarize(w: Workout): string {
  const sets = workoutSetsDone(w.entries);
  const time = formatElapsed(workoutElapsed(w, 0));
  return sets > 0 ? `${sets} sets · ${time}` : time;
}

/** What an entry says it was, in one line: the words if there are any, the
 * measurement otherwise. A tick has neither and simply reads as kept. */
function describe(entry: Entry, tracker: Tracker | null): string {
  if (entry.body.trim()) return entry.body;
  const measured = tracker ? formatValue(tracker, entry.value) : "";
  return measured || "Logged";
}

/** The day's ritual slots, each resolved against what actually happened.
 *
 * Joins in memory rather than asking the server a question per slot: the
 * schedule (local), recent sessions (already cached for the gym space and the
 * live bar), the trackers, and the day's entries. */
export function useDayRituals(date: string): DayRitual[] {
  const rituals = useRituals();
  const occurrences = useMemo(() => occurrencesFor(date, rituals), [date, rituals]);

  const wantsTraining = occurrences.some((o) => o.ritual.kind === "training");
  const wantsEntries = occurrences.some((o) => o.ritual.kind === "tracker");

  const { data: workouts } = useWorkouts();
  const { data: routines } = useRoutines();
  const { data: trackers } = useTrackers();
  // Only asked for when a tracker slot actually falls on this day — the week
  // grid mounts seven of these at once.
  const { data: entries } = useEntriesDay(date, wantsEntries);

  const isToday = date === localDate();
  const nowMin = useNowMinutes(isToday);

  return useMemo(() => {
    const dayWorkouts = wantsTraining
      ? (workouts ?? []).filter((w) => localDateOf(w.started_at) === date)
      : [];
    const byRoutine = new Map((routines ?? []).map((r) => [r.id, r]));
    const byTracker = new Map((trackers ?? []).map((t) => [t.id, t]));

    return occurrences.map((o) => {
      const { kind } = o.ritual;
      const routine = kind === "training" ? (byRoutine.get(o.ritual.ref) ?? null) : null;
      const tracker = kind === "tracker" ? (byTracker.get(o.ritual.ref) ?? null) : null;
      // A ritual pointing at something deleted falls back to "anything counts"
      // rather than becoming permanently unkeepable.
      const ref = (kind === "training" ? routine : tracker) ? o.ritual.ref : "";

      // Whatever happened counts for the slot whose band it landed in; a ritual
      // with nothing picked yet is answered by anything of its sort that day.
      const filled =
        kind === "training"
          ? dayWorkouts.find((w) => {
              if (ref && w.routine !== ref) return false;
              const m = minutesOfDay(w.started_at);
              return m >= o.from_min && m < o.to_min;
            })
          : undefined;
      const entry =
        kind === "tracker"
          ? (entries ?? []).find((e) => {
              if (ref && e.tracker !== ref) return false;
              const m = minutesOfDay(e.at);
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
        // An unpointed ritual is answered by any tracker's entry, so the words
        // come from whichever one actually filled it.
        note = describe(entry, tracker ?? byTracker.get(entry.tracker) ?? null);
      } else if (nowMin === null) {
        // Not today: the past is missed, the future is still to come.
        state = date < localDate() ? "missed" : "upcoming";
        note = plan(o, routine, tracker);
      } else if (nowMin < o.start_min) {
        state = "upcoming";
        note = plan(o, routine, tracker);
      } else if (nowMin < o.to_min) {
        state = "due";
        note = plan(o, routine, tracker);
      } else {
        state = "missed";
        note = plan(o, routine, tracker);
      }

      return { ...o, state, note, workoutId: filled?.id ?? "", routine, tracker };
    });
  }, [occurrences, workouts, routines, trackers, entries, date, nowMin, wantsTraining]);
}

/** What the slot is *for*, shown until something fills it. */
function plan(o: Occurrence, routine: Routine | null, tracker: Tracker | null): string {
  if (o.ritual.kind === "tracker") {
    if (o.count > 1) return `${o.index} of ${o.count}`;
    return tracker ? `No ${tracker.name.toLowerCase()} yet` : "Nothing logged yet";
  }
  if (!routine) return "Any session counts";
  const n = routine.items.length;
  return `${n} ${n === 1 ? "exercise" : "exercises"}`;
}
