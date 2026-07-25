import { Pause, Play, Square } from "lucide-react-native";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { useShadow } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import { confirmDestructive } from "@/lib/confirm";
import { hapticLift, hapticSuccess, hapticTap } from "@/lib/haptics";
import { FRAME_W } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useNow } from "../clock";
import { BAR_H, PUCK_H } from "../live-bar";
import { useLiveBar } from "../store";
import { formatElapsed, workoutElapsed, workoutSetsDone, type Workout } from "../types";

/** How far you have to fling before the bar tucks to that edge. */
const TUCK_AT = 84;
/** Motion settles, it never bounces — eased returns, no spring overshoot. */
const EASE = { duration: 220, easing: Easing.out(Easing.cubic) };

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
}: {
  workout: Workout;
  bottom: number;
  onOpen: () => void;
  onPause: () => void;
  onFinish: () => void;
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

  const finish = () => {
    hapticTap();
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
        x.value = withTiming(0, EASE);
      }
    });

  if (tucked) {
    return (
      <View pointerEvents="box-none" style={[styles.layer, { bottom }]}>
        <View pointerEvents="box-none" style={styles.frame}>
          <Animated.View
            entering={FadeIn.duration(200)}
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
              <LiveDot color={accent} paused={paused} />
              <Text style={[styles.puckClock, fontStyle("fraunces", "700"), { color: accent }]}>
                {clock}
              </Text>
            </PressableScale>
          </Animated.View>
        </View>
      </View>
    );
  }

  const sets = workoutSetsDone(workout.entries);

  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom }]}>
      <View pointerEvents="box-none" style={styles.frame}>
        <GestureDetector gesture={fling}>
          <Animated.View
            entering={FadeInDown.duration(260)}
            exiting={FadeOut.duration(160)}
            style={[styles.bar, island, drag]}
          >
            <Grain radius={999} />
            <PressableScale
              scaleTo={0.99}
              accessibilityLabel={`Open ${workout.title}`}
              onPress={onOpen}
              style={styles.body}
            >
              <LiveDot color={accent} paused={paused} />
              <View style={styles.text}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, type.sansSemiBold, { color: colors.ink }]}
                >
                  {workout.title}
                </Text>
                <Text numberOfLines={1} style={[styles.sub, type.sans, { color: colors.inkMuted }]}>
                  {paused ? "paused" : sets === 0 ? "nothing logged yet" : `${sets} sets logged`}
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

/** Breathing while the clock runs, still while it doesn't — the one cue you
 * can read without looking straight at the bar. */
function LiveDot({ color, paused }: { color: string; paused: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (paused) {
      pulse.value = withTiming(1, { duration: 240 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [paused, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
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
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  dot: { width: 9, height: 9, borderRadius: 999 },
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
