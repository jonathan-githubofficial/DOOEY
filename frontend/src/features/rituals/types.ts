/** The two things that recur on a clock rather than a to-do list: training,
 * and writing down what you ate. Both already have a space that tracks them —
 * a ritual only says *when you meant to*. */
export type RitualKind = "gym" | "journal";

/** A standing commitment. Days and times are the whole schedule: no end date,
 * no every-other-week, no exceptions list. If you skip a day the slot simply
 * goes unkept, which is information, not an error. */
export interface Ritual {
  id: string;
  kind: RitualKind;
  /** Gym: the routine record this slot starts. Journal: always "". An empty
   * ref on a gym ritual means "any training", which is what a freshly added
   * one is until you pick the routine. */
  ref: string;
  label: string;
  /** Local weekdays, 0 = Sunday, matching `Date.getDay()`. */
  days: number[];
  /** Minutes from local midnight — one entry per occurrence that day, which is
   * what makes "three meals" three slots instead of one repeated thing. */
  times: number[];
  /** How much of the timeline the slot blocks out. */
  dur_min: number;
  enabled: boolean;
}

/** One slot on one date, expanded from a ritual's schedule.
 *
 * `from_min`/`to_min` are the slot's *band*: the stretch of the day it owns,
 * running to the midpoints between it and its neighbours. A slot is kept if
 * the thing happened anywhere inside its band, so lunch logged at 1:20 still
 * answers the 1:00 slot and not the 7:00 one. */
export interface Occurrence {
  /** Stable across renders — ritual, date and slot index are all it takes. */
  id: string;
  ritual: Ritual;
  date: string;
  start_min: number;
  dur_min: number;
  from_min: number;
  to_min: number;
  /** 1-based position among the day's slots for this ritual, and how many
   * there are: "2 of 3" only needs saying when there is more than one. */
  index: number;
  count: number;
}
