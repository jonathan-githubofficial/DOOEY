import { Pause, Play, Square } from "lucide-react-native";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Rect } from "react-native-svg";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { useShadow } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import { confirmDestructive } from "@/lib/confirm";
import { hapticLift, hapticSuccess, hapticTap } from "@/lib/haptics";
import { ambient, arrive, dur, timing } from "@/lib/motion";
import { FRAME_W } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useNow } from "../clock";
import { BAR_H, PUCK_H } from "../live-bar";
import { useLiveBar } from "../store";
import { formatElapsed, workoutElapsed, workoutSetsDone, type Workout } from "../types";

/** How far you have to fling before the bar tucks to that edge. */
const TUCK_AT = 84;

/** The session that follows you around: a floating island above the dock while
 * a workout is open, on every page. Pause and finish live on it, the clock is
 * the same one the session page shows, and the body of it reopens the session.
 * Fling it sideways when it's in the way and it tucks to that edge as a puck. */
export function LiveBar({
  workout,
  bottom,
  onOpen,
  onPause,
  onFinish,
  onDiscard,
}: {
  workout: Workout;
  bottom: number;
  onOpen: () => void;
  onPause: () => void;
  onFinish: () => void;
  /** Finishing a session with nothing in it. The session page offers to throw
   * it away rather than file it; the bar has to make the same offer, or the
   * same tap from two places gives two different results — and history fills
   * with empty sessions that are the reason "last time" comes up blank. */
  onDiscard: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const shadow = useShadow();
  const now = useNow();
  const tucked = useLiveBar((s) => s.tucked);
  const tuck = useLiveBar((s) => s.tuck);
  const expand = useLiveBar((s) => s.expand);

  const paused = !!workout.paused_at;
  const clock = formatElapsed(workoutElapsed(workout, now));
  const accent = paused ? colors.inkMuted : colors.zest;

  // The dock's own recipe, to the letter — translucent surface so the paper
  // reads through, a soft rule, the same lift. Two islands, one material.
  const island = {
    backgroundColor: alpha(colors.surface, 0.95),
    borderColor: alpha(colors.rule, 0.7),
    shadowColor: "#282018",
    shadowOpacity: 0.1 * shadow,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: Math.round(3 * shadow),
  } as const;

  const x = useSharedValue(0);
  // Fading as you approach the threshold is the gesture's only feedback that
  // letting go now will tuck it.
  const drag = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: interpolate(Math.abs(x.value), [0, TUCK_AT], [1, 0.72], "clamp"),
  }));

  const done = workoutSetsDone(workout.entries);

  const finish = () => {
    hapticTap();
    if (done === 0) {
      confirmDestructive(
        "Nothing logged yet",
        "Finish anyway? This session will be discarded.",
        "Discard session",
        onDiscard,
      );
      return;
    }
    confirmDestructive("Finish workout?", `${clock} logged.`, "Finish", () => {
      hapticSuccess();
      onFinish();
    });
  };

  const fling = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onChange((e) => {
      x.value += e.changeX;
    })
    .onEnd(() => {
      if (Math.abs(x.value) > TUCK_AT) {
        runOnJS(hapticLift)();
        runOnJS(tuck)(x.value < 0 ? "left" : "right");
        x.value = 0;
      } else {
        x.value = withTiming(0, timing(dur.moved));
      }
    });

  if (tucked) {
    return (
      <View pointerEvents="box-none" style={[styles.layer, { bottom }]}>
        <View pointerEvents="box-none" style={styles.frame}>
          <Animated.View
            entering={FadeIn.duration(dur.moved)}
            style={[styles.puckRow, tucked === "left" ? styles.puckLeft : styles.puckRight]}
          >
            <PressableScale
              scaleTo={0.93}
              accessibilityLabel={`Workout ${clock}, tap to expand`}
              onPress={() => {
                hapticTap();
                expand();
              }}
              style={[styles.puck, island]}
            >
              <Grain radius={999} />
              <LiftGlyph color={accent} paused={paused} />
              <Text style={[styles.puckClock, fontStyle("fraunces", "700"), { color: accent }]}>
                {clock}
              </Text>
            </PressableScale>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom }]}>
      <View pointerEvents="box-none" style={styles.frame}>
        <GestureDetector gesture={fling}>
          <Animated.View
            entering={arrive()}
            exiting={FadeOut.duration(dur.quick)}
            style={[styles.bar, island, drag]}
          >
            <Grain radius={999} />
            <PressableScale
              scaleTo={0.99}
              accessibilityLabel={`Open ${workout.title}`}
              onPress={onOpen}
              style={styles.body}
            >
              <LiftGlyph color={accent} paused={paused} />
              <View style={styles.text}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, type.sansSemiBold, { color: colors.ink }]}
                >
                  {workout.title}
                </Text>
                <Text numberOfLines={1} style={[styles.sub, type.sans, { color: colors.inkMuted }]}>
                  {paused ? "paused" : done === 0 ? "nothing logged yet" : `${done} sets logged`}
                </Text>
              </View>
              <Text style={[styles.clock, fontStyle("fraunces", "700"), { color: accent }]}>
                {clock}
              </Text>
            </PressableScale>

            <Round
              label={paused ? "Resume workout" : "Pause workout"}
              tint={colors.zest}
              onPress={() => {
                hapticTap();
                onPause();
              }}
            >
              {paused ? (
                <Play size={15} color={colors.zest} fill={colors.zest} />
              ) : (
                <Pause size={15} color={colors.zest} fill={colors.zest} />
              )}
            </Round>
            {/* The same stop square the session page's Finish wears — one glyph
                for ending a session, wherever you end it from. */}
            <Round label="Finish workout" tint={colors.clay} onPress={finish}>
              <Square size={13} color={colors.clay} fill={colors.clay} />
            </Round>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

/** The glyph's box, and how far the bell travels inside it. */
const GLYPH = 18;
const BELL_H = 12;
const TRAVEL = 5;

/** A dumbbell doing slow reps while the clock runs, racked at the bottom of
 * its travel while it doesn't.
 *
 * This was a pulsing dot, which is what every app in the world puts next to
 * the word "live" — it told you a timer was going but nothing about what for.
 * A bell lifting says *workout* at a glance, from the corner of your eye,
 * without a word of label.
 *
 * The rep is a full `ambient.breath` each way, so a whole cycle is a bit over
 * two seconds: the pace of something being lifted deliberately, not shaken.
 * Nothing here overshoots at the top — the point of the eccentric half is that
 * it comes down under control. */
function LiftGlyph({ color, paused }: { color: string; paused: boolean }) {
  // 0 racked, 1 at the top of the rep.
  const lift = useSharedValue(0);
  useEffect(() => {
    if (paused) {
      lift.value = withTiming(0, timing());
      return;
    }
    lift.value = withRepeat(withTiming(1, ambient.breath), -1, true);
  }, [paused, lift]);

  // Animating the wrapper's transform rather than the SVG's own attributes
  // keeps the whole thing on the UI thread and behaves the same on the web,
  // where the SVG is a DOM node and its props are not shared values.
  const rep = useAnimatedStyle(() => ({
    transform: [{ translateY: TRAVEL * (0.5 - lift.value) }],
  }));

  return (
    <View style={styles.glyph}>
      <Animated.View style={rep}>
        <Svg width={GLYPH} height={BELL_H} viewBox="0 0 18 12">
          {/* Two bells and the bar between them. Three shapes is all that
              survives being 18 points wide. */}
          <Rect x={1.6} y={1.4} width={3.2} height={9.2} rx={1.3} fill={color} />
          <Rect x={4.4} y={5.1} width={9.2} height={1.8} rx={0.9} fill={color} />
          <Rect x={13.2} y={1.4} width={3.2} height={9.2} rx={1.3} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function Round({
  label,
  tint,
  onPress,
  children,
}: {
  label: string;
  tint: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      scaleTo={0.88}
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={[styles.round, { backgroundColor: alpha(tint, 0.14) }]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    // The bar hangs outside the navigator, so it centres itself the way the
    // dock does. An absolute box with both left AND right pinned is already
    // width-constrained, so `alignSelf` on it is ignored and the bar drops
    // into the left gutter — the frame has to be a child that centres here.
    alignItems: "center",
  },
  frame: {
    width: "100%",
    // The web build sits in a tablet-width frame; the bar has to respect it.
    ...(Platform.OS === "web" ? { maxWidth: FRAME_W } : null),
  },
  bar: {
    marginHorizontal: 14,
    height: BAR_H,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
  },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  // A fixed box, so the bell travelling inside it never nudges the title.
  glyph: { width: GLYPH, height: GLYPH, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  title: { fontSize: 14.5, letterSpacing: -0.2 },
  sub: { fontSize: 11, marginTop: 1 },
  clock: { fontSize: 17, fontVariant: ["tabular-nums"], letterSpacing: -0.3, marginRight: 4 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  puckRow: { flexDirection: "row", paddingHorizontal: 14 },
  puckLeft: { justifyContent: "flex-start" },
  puckRight: { justifyContent: "flex-end" },
  puck: {
    height: PUCK_H,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
  },
  puckClock: { fontSize: 14.5, fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
});
