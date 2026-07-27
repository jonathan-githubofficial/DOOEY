import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import { hapticTap } from "@/lib/haptics";
import { dur, ease, settle } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { MUSCLE_SLUG } from "../anatomy";
import { useCardInk } from "../hues";
import type { Journey, RhythmDay } from "../rotation";
import { useWorkoutPrefs } from "../store";
import type { CardHue } from "../types";
import { WeekBody } from "./WeekBody";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** This week's keys stay the size they always were; the weeks behind them are
 * drawn compact. Uniform cells would be the prettier picture, but the whole
 * point of the expansion is that the row you were already reading does not
 * move — it is the "you are here", and it should stay the loudest thing in the
 * grid once the grid arrives. */
const KEY_H = 30;
const PAST_H = 13;

/** Rows fade in from the current week outwards, and the stagger stops after
 * this many — nobody watches the top of a six-month grid arrive. */
const MAX_STAGGER = 8;

type Side = "front" | "back";

const other = (s: Side): Side => (s === "front" ? "back" : "front");

/** Which view shows more of this week's work. Ties — and an untrained week —
 * go to the front, the side people expect to see first. */
function busiestSide(painted: Map<string, CardHue>): Side {
  let front = 0;
  let back = 0;
  for (const target of painted.keys()) {
    const placed = MUSCLE_SLUG[target];
    if (placed?.side === "front") front++;
    else if (placed?.side === "back") back++;
  }
  return back > front ? "back" : "front";
}

/** The week at a glance, and — when you open it — every week before it.
 *
 * There used to be a Workout/History pair in the masthead. Two labels that
 * could have said anything, telling you nothing until you had tried both. But
 * this panel is already a calendar of your training, and history is not a
 * different subject: it is this, further back. So the strip *becomes* the
 * history rather than linking to it, and the masthead gets its title back.
 *
 * Open, the figure steps aside: at six months of zoom your body is not the
 * subject any more, time is. Every day that holds a session is a way into it.
 */
export function WeekPanel({
  journey,
  painted,
  rested,
  open,
  onToggle,
  onOpenSession,
}: {
  journey: Journey;
  painted: Map<string, CardHue>;
  rested: string[];
  open: boolean;
  onToggle: () => void;
  onOpenSession: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const gender = useWorkoutPrefs((s) => s.gender);
  // Open on the side the week actually happened on — a leg day lives on the
  // back, and a figure showing none of your work is worse than no figure.
  const [flipped, setFlipped] = useState(false);
  const busiest = busiestSide(painted);
  const side = flipped ? other(busiest) : busiest;

  const weeks = journey.weeks;
  const thisWeek = weeks[weeks.length - 1];
  const earlier = weeks.slice(0, -1);
  const days = thisWeek.filter((d) => d.hueKey).length;
  const shaded = new Map([...painted].map(([target, hue]) => [target, ink(hue).solid]));

  const since = journey.clipped
    ? "Your last six months"
    : journey.first
      ? `Since ${journey.first.getDate()} ${MONTHS[journey.first.getMonth()]}`
      : "Nothing logged yet — the first one fills a square";

  return (
    <Panel style={styles.panel}>
      <Animated.View layout={settle()} style={styles.top}>
        {!open && (
          <Animated.View
            entering={FadeIn.duration(dur.quick)}
            exiting={FadeOut.duration(dur.instant)}
            layout={settle()}
            style={styles.figureWrap}
          >
            <Pressable
              accessibilityLabel={`Show ${side === "front" ? "back" : "front"} of the body`}
              onPress={() => setFlipped(!flipped)}
              style={styles.figure}
            >
              <WeekBody painted={shaded} gender={gender} side={side} scale={0.42} />
            </Pressable>
          </Animated.View>
        )}

        <View style={styles.body}>
          <View style={styles.headRow}>
            <Eyebrow>{open ? "your journey" : "this week"}</Eyebrow>
            {/* The one control that switches the page, in the corner every
                space keeps its action in. It carries the number rather than
                the word "History", because the number is the part you can't
                work out by looking. */}
            <PressableScale
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              accessibilityLabel={open ? "Back to this week" : "Show every week you've trained"}
              onPress={() => {
                hapticTap();
                onToggle();
              }}
              style={[
                styles.key3,
                { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
              ]}
            >
              {open ? (
                <ChevronUp size={14} color={colors.inkMuted} />
              ) : (
                <ChevronDown size={14} color={colors.inkMuted} />
              )}
              <Text numberOfLines={1} style={[type.sansMedium, styles.keyText3, { color: colors.ink }]}>
                {open ? "This week" : `${journey.sessions} logged`}
              </Text>
            </PressableScale>
          </View>
          <Text style={[fontStyle("fraunces", "900"), styles.count, { color: colors.ink }]}>
            {open
              ? `${journey.sessions} ${journey.sessions === 1 ? "session" : "sessions"}`
              : `${days} ${days === 1 ? "day" : "days"}`}
          </Text>

          <Animated.View layout={settle()} style={styles.grid}>
            {open &&
              earlier.map((week, wi) => (
                <Animated.View
                  key={week[0].date.toISOString()}
                  // Nearest weeks first: the grid grows away from the row you
                  // were already looking at, rather than raining down onto it.
                  entering={FadeIn.duration(dur.quick)
                    .easing(ease.out)
                    .delay(Math.min(earlier.length - 1 - wi, MAX_STAGGER) * 22)}
                  exiting={FadeOut.duration(dur.instant)}
                  style={styles.row}
                >
                  {week.map((day) => (
                    <DayCell key={day.date.toISOString()} day={day} compact onOpen={onOpenSession} />
                  ))}
                </Animated.View>
              ))}

            <Animated.View layout={settle()} style={[styles.row, open && styles.thisWeekRow]}>
              {thisWeek.map((day, i) => (
                <DayCell
                  key={day.date.toISOString()}
                  day={day}
                  letter={LETTERS[i]}
                  onOpen={onOpenSession}
                />
              ))}
            </Animated.View>
          </Animated.View>

          {(open || rested.length > 0) && (
            <Animated.View layout={settle()}>
              <Text numberOfLines={1} style={[type.sans, styles.footText, { color: colors.inkMuted }]}>
                {open ? (
                  since
                ) : (
                  <>
                    Longest rested:{" "}
                    <Text style={[type.sansSemiBold, { color: colors.ink }]}>{rested.join(" · ")}</Text>
                  </>
                )}
              </Text>
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Panel>
  );
}

/** One day: tinted with what you trained, and a way into the session when
 * there is one.
 *
 * The two sizes are not the same drawing scaled. This week's keys are the
 * control they always were — dashed outlines for the days still open, a solid
 * ring on today. The weeks behind are a *field*: a rest day back there is a
 * flat wash, because five rows of dashed outlines is noise, and the thing you
 * are meant to read at that zoom is where the colour is and where it isn't. */
function DayCell({
  day,
  compact,
  letter,
  onOpen,
}: {
  day: RhythmDay;
  compact?: boolean;
  letter?: string;
  onOpen: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const hit = day.hueKey ? ink(day.hueKey).solid : null;

  const face = (
    <View
      style={[
        styles.key,
        compact
          ? { height: PAST_H, borderRadius: 3 }
          : { height: KEY_H, borderRadius: 9 },
        hit
          ? { backgroundColor: hit }
          : compact
            ? { backgroundColor: alpha(colors.ink, 0.05) }
            : { borderWidth: 1.2, borderStyle: "dashed", borderColor: colors.rule },
        day.isToday && !hit && !compact && { borderStyle: "solid", borderColor: colors.ink },
      ]}
    >
      {!!letter && (
        <Text
          style={[
            type.sansSemiBold,
            styles.keyText,
            { color: hit ? colors.surface : day.isToday ? colors.ink : colors.inkMuted },
          ]}
        >
          {letter}
        </Text>
      )}
    </View>
  );

  if (!day.workoutId) return <View style={styles.cell}>{face}</View>;
  return (
    <PressableScale
      scaleTo={0.88}
      accessibilityLabel={`Open the session from ${day.date.getDate()} ${MONTHS[day.date.getMonth()]}`}
      onPress={() => {
        hapticTap();
        onOpen(day.workoutId!);
      }}
      style={styles.cell}
    >
      {face}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16 },
  top: { flexDirection: "row", gap: 16, alignItems: "center" },
  figureWrap: { alignItems: "center" },
  figure: { width: 66, alignItems: "center" },
  body: { flex: 1 },
  count: { fontSize: 27, letterSpacing: -0.9, marginTop: 1 },
  // The column gap is the same in every row or the columns don't line up —
  // it's one grid, not a strip with a chart above it.
  grid: { marginTop: 11, gap: 4 },
  row: { flexDirection: "row", gap: 6 },
  // A hair of air above this week, so the bold row reads as the base of the
  // grid rather than one more entry in it.
  thisWeekRow: { marginTop: 4 },
  cell: { flex: 1 },
  key: { alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 11, letterSpacing: 0.4 },
  footText: { fontSize: 11.5, marginTop: 11 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  // The app's plain control: a paper key on a rule hairline, the same recipe
  // the planner's view keys and the composer's chips wear.
  key3: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  keyText3: { flexShrink: 1, fontSize: 12 },
});
