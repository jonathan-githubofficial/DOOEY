import { Dumbbell } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { Eyebrow, Panel, StampButton } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
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

/** The scallops bitten out of the card's four edges, and the gap between them:
 * `components/stamp-edge.tsx`'s own numbers, so a torn ticket and a postage
 * stamp are recognisably the same workshop. */
const SCALLOP = 3.5;
const GAP = 12;

/** The two big bites where the tear meets the card's sides — the notch a ticket
 * has so a thumb knows where to fold it. */
const BITE = 11;

/** The perforation between them. */
const HOLE = 4;

/** Every bite is filled with the page's colour and drawn with a cut edge.
 *
 * The fill alone is not enough and it took a screenshot to see why: `paper` and
 * `surface` are four points of lightness apart in both themes, so a paper bite
 * out of a paper-white card is invisible — it only showed where the card was
 * tinted. A hole in real paper does not read as a colour change anyway, it reads
 * as an edge, and the SVG viewport clips each circle to exactly the half that
 * falls inside the card, so this arc lands on the bite's inner rim and nowhere
 * else. */
function useCut(): { fill: string; stroke: string } {
  const colors = usePalette();
  return { fill: colors.paper, stroke: alpha(colors.ink, 0.16) };
}

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

/** Scallop centres along one edge: centred on it and spreading out in even
 * steps, so both ends keep the same margin. They stop clear of the corners,
 * which is what leaves the radius the user chose a clean curve. */
function scallops(length: number, margin: number): number[] {
  const middle = length / 2;
  const out = [middle];
  for (let k = 1; middle - k * GAP > margin; k++) {
    out.unshift(middle - k * GAP);
    out.push(middle + k * GAP);
  }
  return out;
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
 * half you act on. A divider could say neither. */
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
  return (
    <Panel style={styles.ticket}>
      <Counterfoil
        week={week}
        painted={painted}
        rested={rested}
        target={target}
        onOpenSession={onOpenSession}
      />
      <Stub next={next} />
      {/* Last, so it bites into both halves and whatever they were carrying. */}
      <TicketEdge />
    </Panel>
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
}: {
  week: RhythmDay[];
  painted: Map<string, WeekMuscle>;
  rested: string[];
  target: number;
  onOpenSession: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const radius = useCardRadius();
  const gender = useWorkoutPrefs((s) => s.gender);
  const shaded = new Map<string, Paint>(
    [...painted].map(([muscle, m]) => [muscle, { color: ink(m.hue).solid, strong: m.strong }]),
  );
  const days = week.filter((d) => d.hueKey).length;
  const hue = weekHue(painted);
  /** A wash of the week's hue, not a field of it.
   *
   * `ink().field` is what a *card* wears, and giving the plate one made the
   * loudest colour on the ticket belong to its least important half: a pink
   * plate reading against a green stub, when the stub is the part you act on.
   * Nothing on a ticket should out-shout the stub. A week with nothing in it
   * gets the quietest plate of all rather than a colour it hasn't earned. */
  const wash = alpha(hue ? ink(hue).solid : colors.ink, hue ? 0.12 : 0.035);

  return (
    <View style={styles.record}>
      {/* Front and back together, feet on one line. Half the muscles a week
          hits don't show from the front, so one view of a week of pulling is
          an untouched body. */}
      <View
        style={[styles.art, { backgroundColor: wash, borderTopLeftRadius: radius - 1 }]}
        pointerEvents="none"
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

      <Perforation edge="bottom" />
    </View>
  );
}

/** The half you act on. Which of the four states it is in decides its colour:
 * a routine's hue when there is one to train, plain paper when there is not,
 * because a ticket for nothing is not a coloured ticket. */
function Stub({ next }: { next: TicketNext }) {
  if (next.kind === "live") {
    const sets = workoutSetsDone(next.workout.entries);
    const focus = focusOf(next.workout.entries);
    return (
      <Action
        hue={focus?.hueKey ?? "zest"}
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
        hue={hueOf(routine)}
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
    <StubShell field={ink.field}>
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

/** The stub's box: its colour field, its rounded bottom corners, and its half
 * of the perforation. */
function StubShell({ field, children }: { field?: string; children: ReactNode }) {
  const radius = useCardRadius();
  return (
    <View
      style={[
        styles.stub,
        // Inside the Panel's own 1pt border, so the field doesn't square off
        // the corner the card is drawn with.
        { borderBottomLeftRadius: radius - 1, borderBottomRightRadius: radius - 1 },
        !!field && { backgroundColor: field },
      ]}
    >
      {/* The Panel's own grain is under the field, so the stub prints its own.
          Clipped to a hole's radius, which the fold notch at each top corner
          covers many times over. The bottom corners come from this box's
          overflow, which already follows the card. */}
      {!!field && <Grain radius={HOLE} />}
      <Perforation edge="top" />
      {children}
    </View>
  );
}

/** The card's perforated silhouette: a scallop bitten out of every edge, the way
 * a stamp or a torn ticket is cut.
 *
 * Painted in `colors.paper` on top of the card rather than cut out of it. A real
 * cutout — the CSS mask and evenodd path `stamp-edge` uses — would mean none of
 * the card's colour fields could run to its edges, and the art plate bleeding
 * off the leading edge is the point of the counterfoil. The page behind is
 * paper, so a paper bite is a hole.
 *
 * It also means the card keeps a rectangle's shadow while showing a scalloped
 * edge. The bites are 3.5pt deep against a soft 8pt shadow, so there is nothing
 * to see; a genuine cutout would have cost the shadow altogether on Android,
 * where elevation follows a view's bounds and not its paint. */
function TicketEdge() {
  const cut = useCut();
  const radius = useCardRadius();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  const margin = Math.max(radius, GAP);

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
          {scallops(w, margin).flatMap((cx, i) => [
            <Circle key={`t${i}`} cx={cx} cy={0} r={SCALLOP} strokeWidth={1} {...cut} />,
            <Circle key={`b${i}`} cx={cx} cy={h} r={SCALLOP} strokeWidth={1} {...cut} />,
          ])}
          {scallops(h, margin).flatMap((cy, i) => [
            <Circle key={`l${i}`} cx={0} cy={cy} r={SCALLOP} strokeWidth={1} {...cut} />,
            <Circle key={`r${i}`} cx={w} cy={cy} r={SCALLOP} strokeWidth={1} {...cut} />,
          ])}
        </Svg>
      )}
    </View>
  );
}

/** Half a tear line: a big fold notch at each end and the perforation between
 * them, each half drawing the half of every circle that falls inside it.
 *
 * Split between the two halves rather than straddling them, so neither has to
 * paint outside its own box — which is the one thing that would put this at the
 * mercy of three platforms' overflow and z-order rules. */
function Perforation({ edge }: { edge: "top" | "bottom" }) {
  const cut = useCut();
  const [w, setW] = useState(0);
  const top = edge === "top";
  // Every circle is centred on the tear itself, so this half shows one half of
  // each and the SVG's own viewport clips the rest.
  const cy = top ? 0 : BITE;
  return (
    <View
      pointerEvents="none"
      style={[styles.tear, top ? { top: 0 } : { bottom: 0 }]}
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
    >
      {w > 0 && (
        <Svg width={w} height={BITE}>
          <Circle cx={0} cy={cy} r={BITE} strokeWidth={1} {...cut} />
          <Circle cx={w} cy={cy} r={BITE} strokeWidth={1} {...cut} />
          {holeRow(w).map((cx, i) => (
            <Circle key={i} cx={cx} cy={cy} r={HOLE} strokeWidth={1} {...cut} />
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The halves carry their own padding: each one is a colour field that has to
  // run to the card's edge.
  ticket: { padding: 0 },

  record: { flexDirection: "row", alignItems: "stretch" },
  // Full-bleed to the card's leading edge and top, down to the tear. The
  // figures are the week's picture, and a picture on a ticket has a ground.
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

  tear: { position: "absolute", left: 0, right: 0, height: BITE },
});
