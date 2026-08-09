import { Dumbbell } from "lucide-react-native";
import { useId, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, G, Path, Rect } from "react-native-svg";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { Eyebrow, StampButton } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import { usePalette, useElevation, useType } from "@/stores/theme";
import { paintOf, type Paint } from "../anatomy";
import { TWIN_FOOT } from "../card-metrics";
import { useEmblem } from "../emblem";
import { focusOf, hueOf } from "../focus";
import { useCardInk } from "../hues";
import { sinceLabel, type RhythmDay, type WeekMuscle } from "../rotation";
import { useWorkoutPrefs } from "../store";
import { workoutSetsDone, type CardHue, type Routine, type Workout } from "../types";
import { Watermark } from "./card-parts";
import { DayCell, LETTERS } from "./DayCell";
import { WeekBody } from "./WeekBody";

/** Each figure renders 200×400 at scale 1, so a pair is about as wide as one
 * figure is tall. One size for both halves: they are two views of the same
 * body on the same card, and two scales would read as a mistake rather than as
 * a hierarchy. */
const FIGURE_SCALE = 0.33;

const STUB_PAD = 16;

/** How far the stub's figures are pushed past their row so the pair stands on
 * the card's bottom edge rather than floating above it — the way the art on a
 * real ticket runs off the paper instead of sitting in a frame.
 *
 * The library draws inside a viewBox with dead margin under the feet, so this
 * is that margin plus the padding: the *feet* land on the edge, not the box. */
const FOOT_BLEED = STUB_PAD + 400 * FIGURE_SCALE * TWIN_FOOT;

/** The bite taken out of every edge, and the gap between them:
 * `components/stamp-edge.tsx`'s own numbers, so a torn ticket and a postage
 * stamp are recognisably the same workshop. */
const SCALLOP = 3.5;
const GAP = 12;

/** The two big bites where the tear meets the card's sides — the notch a ticket
 * has so a thumb knows where to fold it. */
const BITE = 11;

/** The perforation between them. */
const HOLE = 4;

/** Hole centres across the tear. The gap is nudged to divide the width evenly,
 * which is invisible at a point or two and is what keeps the row symmetrical at
 * any card size; holes that would collide with a fold notch are dropped, so the
 * perforation starts clear of it instead of blobbing into it. */
function holeRow(width: number): number[] {
  const gaps = Math.max(1, Math.round(width / GAP));
  const step = width / gaps;
  const clear = BITE + HOLE;
  return Array.from({ length: gaps + 1 }, (_, i) => i * step).filter(
    (cx) => cx > clear && cx < width - clear,
  );
}

/** Bite centres along one edge: centred on it and spreading out in even steps,
 * so both ends keep the same margin. They stop clear of the corners, which is
 * what leaves the radius the user chose a clean curve, and — on the sides — clear
 * of the fold notch, which is a bite many times their size and does not want
 * three little ones chewing at its mouth.
 *
 * `near` is where the tear crosses this edge, or 0 for an edge it never meets. */
function scallops(length: number, margin: number, near = 0): number[] {
  const middle = length / 2;
  const out = [middle];
  for (let k = 1; middle - k * GAP > margin; k++) {
    out.unshift(middle - k * GAP);
    out.push(middle + k * GAP);
  }
  return near > 0 ? out.filter((at) => Math.abs(at - near) > BITE + SCALLOP) : out;
}

/** A circle as its own subpath, two half-arcs — `stamp-edge.tsx`'s own trick. Under
 * `evenodd` it punches a hole in whatever encloses it. */
function hole(cx: number, cy: number, r: number): string {
  return ` M ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} Z`;
}

/** The card's shape, holes and all: the rounded rectangle the user's radius asks
 * for, with a semicircular bite out of every edge, and the tear punched across
 * the middle.
 *
 * The outline is travelled clockwise, which makes the two arc directions constant:
 * every bite curves inward (sweep 0), every corner outward (sweep 1). The tear is
 * a fold notch at each end and a row of perforations between them, all as circle
 * subpaths — `evenodd` turns each into a hole, and a circle centred on an edge is
 * clipped to the half that falls inside the card, so the notches read as bitten
 * out of the sides and the fold line sits exactly on it.
 *
 * This is the whole ticket in one path. Both halves' colour fields are painted
 * inside it, so the tear cuts the counterfoil's paper above and the stub's field
 * below in one stroke, and the page shows through it. */
function silhouette(w: number, h: number, r: number, tearY: number): string {
  const margin = Math.max(r, GAP);
  const down = scallops(h, margin, tearY);
  const across = scallops(w, margin);
  const bite = (to: string) => `A ${SCALLOP} ${SCALLOP} 0 0 0 ${to}`;
  const corner = (to: string) => `A ${r} ${r} 0 0 1 ${to}`;

  let d = `M ${r} 0`;
  for (const cx of across) d += ` L ${cx - SCALLOP} 0 ${bite(`${cx + SCALLOP} 0`)}`;
  d += ` L ${w - r} 0 ${corner(`${w} ${r}`)}`;
  for (const cy of down) d += ` L ${w} ${cy - SCALLOP} ${bite(`${w} ${cy + SCALLOP}`)}`;
  d += ` L ${w} ${h - r} ${corner(`${w - r} ${h}`)}`;
  for (const cx of [...across].reverse())
    d += ` L ${cx + SCALLOP} ${h} ${bite(`${cx - SCALLOP} ${h}`)}`;
  d += ` L ${r} ${h} ${corner(`0 ${h - r}`)}`;
  for (const cy of [...down].reverse()) d += ` L 0 ${cy + SCALLOP} ${bite(`0 ${cy - SCALLOP}`)}`;
  d += ` L 0 ${r} ${corner(`${r} 0`)} Z`;

  if (tearY > 0) {
    d += hole(0, tearY, BITE) + hole(w, tearY, BITE);
    for (const cx of holeRow(w)) d += hole(cx, tearY, HOLE);
  }
  return d;
}

/** What to do next — the stub's four states, one per shape the answer takes.
 *
 * A union rather than a pile of optional props because these are genuinely
 * exclusive, and because "no routine yet" being *one of the answers* is the
 * whole reason the stub is never simply absent. */
export type TicketNext =
  | { kind: "live"; workout: Workout; onOpen: () => void }
  | {
      kind: "routine";
      routine: Routine;
      programName: string;
      lastDone: string | null;
      onStart: () => void;
      onOpen: () => void;
    }
  | { kind: "invite"; onCreate: () => void }
  | { kind: "waiting" };

/** The gym's hero: one ticket, torn across the middle.
 *
 * Above the perforation is the counterfoil — the record, what you have trained
 * this week, with the week's own body as its art panel. Below it is the stub —
 * the instruction, what to do next, wearing that routine's colour because on a
 * real ticket the detachable half is the coloured one.
 *
 * These were two Panels stacked with a gap, and nothing said they were a pair.
 * They are: one is the record, the other is the instruction. The perforation is
 * what carries that — it says the two halves are one object, and it says which
 * half you act on. A divider could say neither.
 *
 * The whole card is cut, not just the tear: a bite out of every edge, so the
 * object is a torn ticket AND a postage stamp, from the same workshop as
 * `stamp-edge.tsx`. **That cut is the card's only outline** — `styles.ticket`
 * takes the Panel's border off, because the two together were what read as a
 * fence around the hero rather than as torn paper. See `HAIRLINE`. */
export function TrainingTicket({
  week,
  painted,
  rested,
  target,
  next,
  onOpenSession,
}: {
  /** Monday→Sunday, this week. */
  week: RhythmDay[];
  /** Every muscle the week has hit, and how hard. */
  painted: Map<string, WeekMuscle>;
  rested: string[];
  /** Sessions a week your split implies — the routines in the program you are
   * following. The headline reads against it, so the target moves when you
   * change split instead of being a number you had to go and set. */
  target: number;
  next: TicketNext;
  onOpenSession: (id: string) => void;
}) {
  const colors = usePalette();
  const radius = useCardRadius();
  const elevation = useElevation();
  const ink = useCardInk();
  /** Where the tear crosses the card's sides, and how wide the art panel came
   * out. The paint needs both: the tear is where the stub's field starts, and
   * bites near it have to get out of the fold notch's way. */
  const [tearY, setTearY] = useState(0);
  const [artW, setArtW] = useState(0);
  const hue = weekHue(painted);
  /** A wash of the week's hue, not a field of it.
   *
   * `ink().field` is what a *card* wears, and giving the plate one made the
   * loudest colour on the ticket belong to its least important half: a pink
   * plate reading against a green stub, when the stub is the part you act on.
   * Nothing on a ticket should out-shout the stub. A week with nothing in it
   * gets the quietest plate of all rather than a colour it hasn't earned. */
  const wash = alpha(hue ? ink(hue).solid : colors.ink, hue ? 0.12 : 0.035);
  const stubHue = stubHueOf(next);

  // Not a Panel. A Panel's job is to paint an opaque rounded rectangle, and a
  // rectangle behind a cut edge is the one thing this card cannot have.
  return (
    <View style={[styles.ticket, elevation]}>
      <TicketPaint
        tearY={tearY}
        artW={artW}
        wash={wash}
        field={stubHue ? ink(stubHue).field : null}
      />
      {/* Over the paint and under the content, which is where a Panel keeps it. */}
      <Grain radius={radius} />
      <Counterfoil
        week={week}
        painted={painted}
        rested={rested}
        target={target}
        onOpenSession={onOpenSession}
        onTear={setTearY}
        onArt={setArtW}
      />
      <Stub next={next} hue={stubHue} />
    </View>
  );
}

/** The hue the stub wears, which is also the colour of the field lying under it.
 * Lifted out of the stub because the paint is drawn before the stub is, and both
 * have to name the same colour. */
function stubHueOf(next: TicketNext): CardHue | null {
  if (next.kind === "live") return focusOf(next.workout.entries)?.hueKey ?? "zest";
  if (next.kind === "routine") return hueOf(next.routine);
  return null;
}

/** The card's paint: every colour field the ticket wears, drawn inside one clip
 * of the cut silhouette.
 *
 * **This is what makes the ticket _be_ the shape** instead of a rectangle with
 * bites painted over it. The bites are cut out of the clip, so the page shows
 * through them — its own grain, its own backdrop — and showing the page always
 * beats matching a flat colour to a textured one, which is the trap every earlier
 * attempt at this edge fell into.
 *
 * The rule it buys is that **every colour the card wears has to be drawn in
 * here**. A View with a background of its own squares the cut straight back off
 * over whatever stretch it covers, which is what the counterfoil's plate and the
 * stub's field each used to do. */
function TicketPaint({
  tearY,
  artW,
  wash,
  field,
}: {
  tearY: number;
  /** How far the counterfoil's art plate reaches from the leading edge. */
  artW: number;
  wash: string;
  field: string | null;
}) {
  const colors = usePalette();
  const radius = useCardRadius();
  // Two tickets on one screen would otherwise share a clip id and the second
  // would be clipped by the first's shape. Colons are legal in an id and not in
  // a `url(#…)` reference.
  const clip = `cut${useId().replace(/:/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setSize({
          w: Math.round(e.nativeEvent.layout.width),
          h: Math.round(e.nativeEvent.layout.height),
        })
      }
    >
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          <Defs>
            <ClipPath id={clip}>
              {/* `evenodd` twice on purpose. The spec puts `clip-rule` on the
                  clip path's children, which is what the web needs; this library
                  reads it off the node doing the clipping, which is what iOS
                  (`CGContextEOClip`) and Android (`Path.FillType.EVEN_ODD`) act
                  on. Without both, the tear's holes stop being holes on one
                  target or the other. */}
              <Path d={silhouette(w, h, radius, tearY)} clipRule="evenodd" fillRule="evenodd" />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clip})`} clipRule="evenodd">
            <Rect x={0} y={0} width={w} height={h} fill={colors.surface} />
            {/* Full-bleed to the leading edge and the tear: a picture on a ticket
                has a ground, and the ground is what runs off the paper. */}
            {artW > 0 && <Rect x={0} y={0} width={artW} height={tearY} fill={wash} />}
            {!!field && tearY > 0 && (
              <Rect x={0} y={tearY} width={w} height={h - tearY} fill={field} />
            )}
          </G>
        </Svg>
      )}
    </View>
  );
}

/** The colour the week came out: the accent that shaded the most muscles you
 * actually trained. The art panel wears it, so the plate behind the figures is
 * a fact about your week rather than a decoration. */
function weekHue(painted: Map<string, WeekMuscle>): CardHue | null {
  const tally = new Map<CardHue, number>();
  for (const m of painted.values()) {
    if (!m.strong) continue;
    tally.set(m.hue, (tally.get(m.hue) ?? 0) + 1);
  }
  let best: CardHue | null = null;
  let most = 0;
  for (const [hue, count] of tally) {
    if (count > most) {
      most = count;
      best = hue;
    }
  }
  return best;
}

/** Which week this is, the way a ticket prints a date: short, tracked, and in
 * figures you can line up. `21–27 Jul`, or across a month boundary,
 * `28 Jul–3 Aug`. */
function weekSpan(week: RhythmDay[]): string {
  const from = week[0].date;
  const to = week[week.length - 1].date;
  const long = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${long(to)}`
    : `${long(from)}–${long(to)}`;
}

/** The record half. Paper, like the page — the ticket's colour belongs to the
 * part you tear off — with the week's body standing in a full-bleed art panel
 * at the leading edge, which is where a ticket puts its picture. */
function Counterfoil({
  week,
  painted,
  rested,
  target,
  onOpenSession,
  onTear,
  onArt,
}: {
  week: RhythmDay[];
  painted: Map<string, WeekMuscle>;
  rested: string[];
  target: number;
  onOpenSession: (id: string) => void;
  /** This half's height, which is where the tear falls. */
  onTear: (y: number) => void;
  /** How wide the figures made the art panel, so the paint can lay its plate
   * under exactly them. */
  onArt: (w: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const gender = useWorkoutPrefs((s) => s.gender);
  const shaded = new Map<string, Paint>(
    [...painted].map(([muscle, m]) => [muscle, { color: ink(m.hue).solid, strong: m.strong }]),
  );
  const days = week.filter((d) => d.hueKey).length;

  return (
    <View
      style={styles.record}
      onLayout={(e) => onTear(Math.round(e.nativeEvent.layout.height))}
    >
      {/* Front and back together, feet on one line. Half the muscles a week
          hits don't show from the front, so one view of a week of pulling is
          an untouched body. The plate they stand in is painted by `TicketPaint`,
          not by this box: a background here would square off every bite it
          covered. This box only says how much room the figures take. */}
      <View
        style={styles.art}
        pointerEvents="none"
        onLayout={(e) => onArt(Math.round(e.nativeEvent.layout.width))}
      >
        <View style={styles.figures}>
          <WeekBody painted={shaded} gender={gender} side="front" scale={FIGURE_SCALE} />
          <WeekBody painted={shaded} gender={gender} side="back" scale={FIGURE_SCALE} />
        </View>
      </View>

      <View style={styles.recordBody}>
        <Eyebrow style={styles.stamped}>{weekSpan(week)}</Eyebrow>
        {/* Progress, not a tally. "1 day" was a fact you could already count
            off the grid below it; "1 of 4 days" says how the week is going,
            because the 4 is what your own split asks of you. */}
        <Text
          numberOfLines={1}
          style={[fontStyle("fraunces", "900"), styles.count, { color: colors.ink }]}
        >
          {target > 0 ? `${days} of ${target}` : `${days}`}
          <Text style={[type.sans, styles.countUnit, { color: colors.inkMuted }]}>
            {days === 1 && target === 0 ? " day this week" : " days this week"}
          </Text>
        </Text>

        <View style={styles.grid}>
          {week.map((day, i) => (
            <DayCell
              key={day.date.toISOString()}
              day={day}
              letter={LETTERS[i]}
              onOpen={onOpenSession}
            />
          ))}
        </View>

        {rested.length > 0 && (
          <Text numberOfLines={1} style={[type.sans, styles.footText, { color: colors.inkMuted }]}>
            Longest rested:{" "}
            <Text style={[type.sansSemiBold, { color: colors.ink }]}>{rested.join(" · ")}</Text>
          </Text>
        )}
      </View>
    </View>
  );
}

/** The half you act on. Which of the four states it is in decides its colour:
 * a routine's hue when there is one to train, plain paper when there is not,
 * because a ticket for nothing is not a coloured ticket.
 *
 * The field itself is laid down by `TicketPaint`; `hue` is the same one it used,
 * so the stamp and the watermark here read against the colour actually under
 * them. */
function Stub({ next, hue }: { next: TicketNext; hue: CardHue | null }) {
  if (next.kind === "live") {
    const sets = workoutSetsDone(next.workout.entries);
    const focus = focusOf(next.workout.entries);
    return (
      <Action
        hue={hue ?? "zest"}
        kicker="in progress"
        title={next.workout.title}
        meta={`${sets} ${sets === 1 ? "set" : "sets"} logged`}
        muscles={focus}
        // No pause or stop here. The live bar above the dock owns those
        // everywhere in the app, and a second controller is how two of them
        // end up disagreeing about what the session is doing.
        action="Resume"
        onAction={next.onOpen}
        onOpen={next.onOpen}
      />
    );
  }

  if (next.kind === "routine") {
    const { routine, programName, lastDone } = next;
    const count = routine.items.length;
    return (
      <Action
        hue={hue ?? hueOf(routine)}
        // Which split this belongs to is the ticket's issuer, and it sat at the
        // end of the meta line where the ellipsis ate it first. Up here it is
        // the caption over the name, which is where a ticket prints it anyway.
        kicker={`next in ${programName}`}
        title={routine.name}
        meta={`${count} ${count === 1 ? "exercise" : "exercises"} · ${sinceLabel(lastDone)}`}
        muscles={focusOf(routine.items)}
        emblem={routine.emblem}
        action="Start"
        onAction={next.onStart}
        onOpen={next.onOpen}
      />
    );
  }

  return (
    <StubShell>
      <View style={styles.note}>
        {next.kind === "invite" ? <Invite onCreate={next.onCreate} /> : <Waiting />}
      </View>
    </StubShell>
  );
}

/** The stub with something to train: the caption, the routine, the one line you
 * need about it, and the page's only Start. Tapping the name opens the routine;
 * only the stamp begins a session. */
function Action({
  hue,
  kicker,
  title,
  meta,
  muscles,
  emblem = [],
  action,
  onAction,
  onOpen,
}: {
  hue: CardHue;
  kicker: string;
  title: string;
  meta: string;
  muscles: { targets: string[]; secondary: string[] } | null;
  /** The routine's own drawing. A live session has no routine to hand, so it
   * takes the fallback: your gym page doodle. */
  emblem?: Stroke[];
  action: string;
  onAction: () => void;
  onOpen: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk()(hue);
  const gender = useWorkoutPrefs((s) => s.gender);
  const mark = useEmblem(emblem);
  /** A routine of only custom moves has no library anatomy behind it. That
   * stub falls back to your doodle rather than standing an unshaded body up. */
  const painted = muscles ? paintOf(muscles.targets, muscles.secondary, ink.stamp) : null;

  return (
    <StubShell>
      {!painted && <Watermark strokes={mark} tint={ink.mark} size={150} />}

      <View style={styles.actionRow}>
        <View style={styles.actionBody}>
          <Pressable accessibilityLabel={`Open ${title}`} onPress={onOpen}>
            <Eyebrow numberOfLines={1} style={styles.stamped}>
              {kicker}
            </Eyebrow>
            <Text
              numberOfLines={2}
              style={[fontStyle("fraunces", "900"), styles.name, { color: colors.ink }]}
            >
              {title}
            </Text>
            <Text numberOfLines={1} style={[type.sans, styles.meta, { color: colors.inkMuted }]}>
              {meta}
            </Text>
          </Pressable>

          <StampButton color={ink.stamp} onPress={onAction} style={styles.start}>
            <Text style={[type.sansSemiBold, styles.startText, { color: ink.field }]}>{action}</Text>
          </StampButton>
        </View>

        {!!painted && (
          <View style={styles.stubArt} pointerEvents="none">
            <WeekBody painted={painted} gender={gender} side="front" scale={FIGURE_SCALE} />
            <WeekBody painted={painted} gender={gender} side="back" scale={FIGURE_SCALE} />
          </View>
        )}
      </View>
    </StubShell>
  );
}

/** Nothing to train yet, so the stub says how to get something. A ticket
 * missing its stub reads as torn, not as empty. */
function Invite({ onCreate }: { onCreate: () => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <>
      <Dumbbell size={24} color={alpha(colors.inkMuted, 0.6)} />
      <Text style={[styles.inviteTitle, type.display, { color: colors.ink }]}>
        Build your first routine
      </Text>
      <Text style={[styles.inviteBody, type.sans, { color: colors.inkMuted }]}>
        Add a few exercises and it’ll show up here, ready to start.
      </Text>
      <Plate label="New routine" onPress={onCreate} style={styles.invitePlate} />
    </>
  );
}

/** The gym is still loading, or the starter program is landing. The stub keeps
 * its shape so the page doesn't jump when the answer arrives. */
function Waiting() {
  const colors = usePalette();
  const type = useType();
  return (
    <Text style={[styles.waiting, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
      Setting up your gym…
    </Text>
  );
}

/** The stub's box: its padding and its half of the perforation, and nothing else.
 *
 * It used to carry the colour field, its own grain over it, and rounded bottom
 * corners to keep the field off the card's. All three moved: the field is painted
 * under the whole card by `TicketPaint`, inside the cut, so the stub has no
 * background to shape and the card's one grain layer already covers it. A box that
 * paints nothing cannot square off a bite. */
function StubShell({ children }: { children: ReactNode }) {
  const radius = useCardRadius();
  return (
    <View
      // The radii are still needed, but for the overflow clip rather than for a
      // background: the stub's figures bleed past the bottom edge on purpose, and
      // this is what stops them at the card's own corner.
      style={[styles.stub, { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // No background, no border, no radius, no padding: the card's whole appearance
  // is `TicketPaint`, inside the cut. This box only holds the halves and casts
  // the shadow, which follows the paint's shape on iOS and the bounds on Android,
  // where a 3.5pt bite against an 8pt blur leaves nothing to see.
  ticket: { position: "relative" },

  record: { flexDirection: "row", alignItems: "stretch" },
  // How much room the figures get at the leading edge. The plate they stand in is
  // painted under them, inside the cut.
  art: {
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 12,
  },
  figures: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  recordBody: { flex: 1, minWidth: 0, justifyContent: "center", padding: 16, paddingLeft: 14 },
  // Tabular, because these are printed figures on a ticket and because the
  // count changes under you as the week fills.
  count: { marginTop: 4, fontSize: 23, letterSpacing: -0.7, fontVariant: ["tabular-nums"] },
  // The unit rides the same line at reading size, so the whole thing is one
  // sentence — the count is what you look at, the words say which week.
  countUnit: { fontSize: 12.5, letterSpacing: 0 },
  grid: { marginTop: 11, flexDirection: "row", gap: 6 },
  footText: { fontSize: 11.5, marginTop: 11 },

  stub: { padding: STUB_PAD, paddingTop: 18, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  actionBody: { flex: 1, minWidth: 0 },
  // The stub's art runs off the bottom edge the way the counterfoil's runs off
  // the leading one.
  stubArt: { flexDirection: "row", alignItems: "flex-end", gap: 2, marginBottom: -FOOT_BLEED },
  // Ticket furniture: the caption over the value, tracked and tabular.
  stamped: { fontVariant: ["tabular-nums"] },
  name: { marginTop: 4, fontSize: 28, letterSpacing: -0.8 },
  meta: { marginTop: 5, fontSize: 12.5 },
  start: { alignSelf: "flex-start", marginTop: 16, paddingHorizontal: 28, paddingVertical: 12 },
  startText: { fontSize: 13, letterSpacing: 2.6, textTransform: "uppercase" },

  note: { alignItems: "center", paddingVertical: 14 },
  inviteTitle: { marginTop: 10, fontSize: 20, letterSpacing: -0.4, textAlign: "center" },
  inviteBody: { marginTop: 6, fontSize: 13, lineHeight: 19, textAlign: "center" },
  invitePlate: { marginTop: 16 },
  waiting: { fontSize: 13, paddingVertical: 22 },

});
