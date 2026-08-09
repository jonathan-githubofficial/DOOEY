/** The two shapes a standing commitment can take.
 *
 * This used to be `"gym" | "journal"`: the app's two tracked things, spelled
 * out. Adding a third meant editing this union, the icon map, the hue map, the
 * slot renderer and the kept/unkept join. Five files to keep one more number.
 *
 * Now a ritual either starts a training session or is answered by an entry
 * against some tracker, and which tracker is a record the user made. Tracking
 * one more thing costs nothing here at all. */
export type RitualKind = "training" | "tracker";

/** A standing commitment. Days and times are the whole schedule: no end date,
 * no every-other-week, no exceptions list. If you skip a day the slot simply
 * goes unkept, which is information, not an error. */
export interface Ritual {
  id: string;
  kind: RitualKind;
  /** Training: the routine record this slot starts. Tracker: the tracker it is
   * answered by. Empty either way means "anything of that sort counts", which
   * is what a freshly added ritual is until you point it somewhere. */
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
