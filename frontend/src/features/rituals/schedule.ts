import { toLocalNoon } from "@/lib/dates";
import { fmtMin } from "@/features/tasks/timeGrid";
import type { Occurrence, Ritual, RitualKind } from "./types";

/** The week as the planner draws it: Monday first, `Date.getDay()` numbers
 * underneath. Storing the raw day number keeps the expansion a one-liner;
 * showing Monday first keeps it agreeing with `weekOf()` and the week grid. */
export const WEEK: { day: number; letter: string; name: string }[] = [
  { day: 1, letter: "M", name: "Monday" },
  { day: 2, letter: "T", name: "Tuesday" },
  { day: 3, letter: "W", name: "Wednesday" },
  { day: 4, letter: "T", name: "Thursday" },
  { day: 5, letter: "F", name: "Friday" },
  { day: 6, letter: "S", name: "Saturday" },
  { day: 0, letter: "S", name: "Sunday" },
];

export const EVERY_DAY = WEEK.map((d) => d.day);

/** What a fresh ritual of each kind blocks out, and when it first lands. A
 * training slot is an hour in the evening; a tracker slot is a quarter hour in
 * the morning, every day. Both are only starting points — every one of these
 * is a control on the Rituals panel, and picking what the slot is for renames
 * it after the thing. */
const SEED: Record<RitualKind, { label: string; dur_min: number; times: number[]; days: number[] }> = {
  training: { label: "Training", dur_min: 60, times: [18 * 60], days: [1, 3, 5] },
  tracker: { label: "Log", dur_min: 15, times: [9 * 60], days: EVERY_DAY },
};

/** What the two kinds were called before rituals stopped knowing what a gym
 * and a food diary are. Read on the way in so an arrangement made under the
 * old names keeps its days and times instead of being silently dropped. */
const LEGACY_KIND: Record<string, RitualKind> = { gym: "training", journal: "tracker" };

function kindOf(raw: unknown): RitualKind | null {
  if (raw === "training" || raw === "tracker") return raw;
  return typeof raw === "string" ? (LEGACY_KIND[raw] ?? null) : null;
}

/** Slot times snap to the same quarter hour the timeline does, so a ritual
 * block always lands on a rule rather than between two. */
export const TIME_STEP = 15;
export const DAY_MINUTES = 24 * 60;

export function newRitual(kind: RitualKind, id: string, ref = "", label?: string): Ritual {
  const seed = SEED[kind];
  return {
    id,
    kind,
    ref,
    label: label ?? seed.label,
    days: [...seed.days],
    times: [...seed.times],
    dur_min: seed.dur_min,
    enabled: true,
  };
}

/** Sorted, deduped, in range — the shape every reader may assume. Applied on
 * the way out of the store, so a hand-edited record or an older app version
 * cannot hand the planner a time of 3000. */
function cleanTimes(times: number[] | undefined): number[] {
  const seen = new Set<number>();
  for (const t of times ?? []) {
    // Range-checked before snapping, not after: rounding -5 gives 0, which
    // would let a nonsense value in as midnight.
    if (!Number.isFinite(t) || t < 0 || t >= DAY_MINUTES) continue;
    seen.add(Math.min(DAY_MINUTES - TIME_STEP, Math.round(t / TIME_STEP) * TIME_STEP));
  }
  return [...seen].sort((a, b) => a - b);
}

function cleanDays(days: number[] | undefined): number[] {
  const seen = new Set<number>();
  for (const d of days ?? []) if (Number.isInteger(d) && d >= 0 && d <= 6) seen.add(d);
  return [...seen].sort((a, b) => a - b);
}

/** Normalize whatever the server (or an old local cache) handed back. Anything
 * unrecognizable is dropped rather than repaired: a ritual with no id or an
 * unknown kind has nothing the planner could draw. */
export function sanitizeRituals(raw: unknown): Ritual[] {
  if (!Array.isArray(raw)) return [];
  const out: Ritual[] = [];
  for (const item of raw) {
    const r = item as Partial<Ritual> | null;
    if (!r || typeof r.id !== "string" || !r.id) continue;
    const kind = kindOf(r.kind);
    if (!kind) continue;
    out.push({
      id: r.id,
      kind,
      ref: typeof r.ref === "string" ? r.ref : "",
      label: typeof r.label === "string" && r.label.trim() ? r.label : SEED[kind].label,
      days: cleanDays(r.days),
      times: cleanTimes(r.times),
      dur_min:
        Number.isFinite(r.dur_min) && (r.dur_min as number) > 0
          ? Math.round(r.dur_min as number)
          : SEED[kind].dur_min,
      enabled: r.enabled !== false,
    });
  }
  return out;
}

export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

export function setTime(times: number[], index: number, minutes: number): number[] {
  const clamped = Math.min(DAY_MINUTES - TIME_STEP, Math.max(0, minutes));
  return cleanTimes(times.map((t, i) => (i === index ? clamped : t)));
}

/** A new slot an hour after the last one, or noon if this is the first.
 *
 * The list is sorted, so an hour past the last slot is always free — unless it
 * runs off the end of the day, where the clamp would land on the existing last
 * slot and dedupe into no new slot at all. Back off a quarter at a time until
 * there is room. */
export function addTime(times: number[]): number[] {
  const last = times.length ? times[times.length - 1] : 11 * 60;
  let next = Math.min(last + 60, DAY_MINUTES - TIME_STEP);
  while (next > 0 && times.includes(next)) next -= TIME_STEP;
  return cleanTimes([...times, next]);
}

export function removeTime(times: number[], index: number): number[] {
  return times.filter((_, i) => i !== index);
}

/** The stretch of the day each slot answers for: from the midpoint with the
 * slot before to the midpoint with the slot after, first and last running out
 * to the day's own edges. This is what lets three meal slots resolve
 * independently against a single flat list of entries. */
export function bandsFor(times: number[]): { from: number; to: number }[] {
  return times.map((t, i) => ({
    from: i === 0 ? 0 : Math.floor((times[i - 1] + t) / 2),
    to: i === times.length - 1 ? DAY_MINUTES : Math.floor((t + times[i + 1]) / 2),
  }));
}

/** Every slot falling on one date, in clock order. Disabled rituals, and ones
 * with no days or no times, expand to nothing. */
export function occurrencesFor(date: string, rituals: Ritual[]): Occurrence[] {
  const dow = toLocalNoon(date).getDay();
  const out: Occurrence[] = [];
  for (const ritual of rituals) {
    if (!ritual.enabled || !ritual.days.includes(dow) || ritual.times.length === 0) continue;
    const bands = bandsFor(ritual.times);
    ritual.times.forEach((start_min, i) => {
      out.push({
        id: `${ritual.id}@${date}#${i}`,
        ritual,
        date,
        start_min,
        dur_min: ritual.dur_min,
        from_min: bands[i].from,
        to_min: bands[i].to,
        index: i + 1,
        count: ritual.times.length,
      });
    });
  }
  return out.sort((a, b) => a.start_min - b.start_min);
}

/** "Mon, Wed, Fri · 6p" — the one line the Rituals panel and the slips both
 * need. Says "Every day" rather than listing seven, and "Never" rather than
 * pretending an empty schedule is a schedule. */
export function describeSchedule(ritual: Ritual): string {
  if (ritual.days.length === 0 || ritual.times.length === 0) return "Never";
  const days =
    ritual.days.length === 7
      ? "Every day"
      : WEEK.filter((d) => ritual.days.includes(d.day))
          .map((d) => d.name.slice(0, 3))
          .join(", ");
  return `${days} · ${ritual.times.map(fmtMin).join(", ")}`;
}

/** Local minute-of-day for an instant — how an entry or a session start is
 * matched against a slot's band. */
export function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}
