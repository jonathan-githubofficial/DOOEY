import type { CardHue } from "@/features/workouts/types";

/** How a thing is measured. The client switches on this and nothing else, which
 * is the whole point: a new aspect is a record, not a branch.
 *
 * Every shape may still carry words. "78, felt bloated" is worth more than
 * either half, so `body` is never gated on the shape. */
export type Shape = "text" | "scale" | "amount" | "duration" | "tick";

export const SHAPES = ["text", "scale", "amount", "duration", "tick"] as const;

export function isShape(v: unknown): v is Shape {
  return typeof v === "string" && (SHAPES as readonly string[]).includes(v);
}

/** An aspect you decided to keep. */
export interface Tracker {
  id: string;
  name: string;
  /** Stable across renames: what rituals point at and what speech resolves to.
   * The name is the label; this is the identity. */
  slug: string;
  shape: Shape;
  /** `amount` and `duration` only; "" for the rest. */
  unit: string;
  /** `scale` only: the ends of the step run. */
  min: number;
  max: number;
  hue: CardHue;
  position: number;
  archived: boolean;
}

/** One moment of one tracker. */
export interface Entry {
  id: string;
  tracker: string;
  /** When it happened, not when it was typed. */
  at: string;
  body: string;
  /** Minutes for `duration`. PocketBase reads an unset number as 0, so this is
   * never null: the shape decides whether it means anything. */
  value: number;
}

/** What this client may write. */
export type TrackerPatch = Partial<
  Pick<Tracker, "name" | "shape" | "unit" | "min" | "max" | "hue" | "position" | "archived">
>;

/** What each shape needs from the user, and how it reads back.
 *
 * `duration` could be an `amount` in hours, and is not, because entering
 * 7h20 and entering 78kg want different controls. A shape earns its place by
 * changing the keypad, not by changing the noun. */
export const SHAPE_SPEC: Record<
  Shape,
  {
    label: string;
    /** Shown while picking a shape: the example does the explaining. */
    hint: string;
    value: boolean;
    unit: boolean;
    range: boolean;
  }
> = {
  text: { label: "Words", hint: "eggs and toast", value: false, unit: false, range: false },
  scale: { label: "A scale", hint: "mood, 4 out of 5", value: true, unit: false, range: true },
  amount: { label: "An amount", hint: "78 kg", value: true, unit: true, range: false },
  duration: { label: "How long", hint: "slept 7h 20m", value: true, unit: false, range: false },
  tick: { label: "A tick", hint: "took the vitamins", value: false, unit: false, range: false },
};

/** What a freshly picked shape starts as, so no form opens empty. */
export function defaultsFor(shape: Shape): Pick<Tracker, "unit" | "min" | "max"> {
  if (shape === "scale") return { unit: "", min: 1, max: 5 };
  if (shape === "amount") return { unit: "kg", min: 0, max: 0 };
  if (shape === "duration") return { unit: "min", min: 0, max: 0 };
  return { unit: "", min: 0, max: 0 };
}

/** The way people say a length of time, back into minutes. `null` when it says
 * nothing usable, which is how the composer knows there is nothing to file.
 *
 * The drawer types a duration into the same box every other shape uses, so
 * there is no stepper to constrain what arrives — "7h 20m", "7h", "45m",
 * "1:20" and a bare "90" all have to land on the same number. Anything else is
 * refused rather than guessed at: a silent 0 would file an empty night's sleep.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const clock = /^(\d+):([0-5]\d)$/.exec(text);
  if (clock) return positive(Number(clock[1]) * 60 + Number(clock[2]));

  // The `m` is optional, which is what makes "7h20" and a bare "90" work:
  // once the hours are named the rest can only be minutes, and minutes are the
  // unit the value is stored in anyway.
  const spoken =
    /^(?:(\d+(?:[.,]\d+)?)\s*h(?:rs?|ours?)?)?\s*(?:(\d+(?:[.,]\d+)?)\s*(?:m(?:ins?|inutes?)?)?)?$/.exec(
      text,
    );
  if (!spoken || (!spoken[1] && !spoken[2])) return null;
  return positive(decimal(spoken[1]) * 60 + decimal(spoken[2]));
}

const decimal = (part: string | undefined): number =>
  part ? parseFloat(part.replace(",", ".")) : 0;

const positive = (minutes: number): number | null =>
  minutes > 0 ? Math.round(minutes) : null;

/** Minutes as the way people say them: "7h 20m", "45m", "2h". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** An entry's measurement, in one line, or "" when the shape doesn't measure.
 * The words live in `body` and are shown beside this, never folded into it. */
export function formatValue(tracker: Tracker, value: number): string {
  switch (tracker.shape) {
    case "scale":
      return `${value} of ${tracker.max}`;
    case "amount":
      return tracker.unit ? `${value} ${tracker.unit}` : String(value);
    case "duration":
      return formatDuration(value);
    default:
      return "";
  }
}

/** A name to its stable key. Collisions get a numeric tail, because the unique
 * index is per owner and two trackers called "Water" is a thing people do. */
export function slugify(name: string, taken: readonly string[] = []): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "tracker";
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const next = `${base.slice(0, 27)}-${n}`;
    if (!taken.includes(next)) return next;
  }
}
