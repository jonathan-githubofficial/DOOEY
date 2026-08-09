import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ambient, timing } from "@/lib/motion";

/** How many bars, and how tall each one gets at full swing. Hand-shaped rather
 * than random: a run that rises, breaks, and rises again reads as speech, and
 * a random one reads as a loading spinner. */
const BARS = [0.35, 0.7, 1, 0.55, 0.85, 0.4, 0.95, 0.6, 0.3, 0.75, 1, 0.45, 0.8, 0.35];

const MAX_H = 26;
const MIN_H = 3;

/** The one long animation this screen is allowed, and it is the same job the
 * breathing halo used to do: say *still listening* without words.
 *
 * It is not a real level meter — the speech module reports transcripts, not
 * amplitude — and it does not pretend to be one: every bar runs its own steady
 * loop, and the shape is fixed. What it honestly reports is that the mic is
 * open, which is the only thing you need to know while you are talking. It
 * stops dead the moment listening does, because a waveform over a closed mic
 * would be a lie. */
export function Waveform({ live, color }: { live: boolean; color: string }) {
  return (
    <View style={styles.row}>
      {BARS.map((peak, i) => (
        <Bar key={i} peak={peak} index={i} live={live} color={color} />
      ))}
    </View>
  );
}

function Bar({
  peak,
  index,
  live,
  color,
}: {
  peak: number;
  index: number;
  live: boolean;
  color: string;
}) {
  const swing = useSharedValue(0);

  useEffect(() => {
    if (live) {
      // Neighbours run at slightly different speeds, so the row ripples instead
      // of pulsing as one block.
      const beat = ambient.breath.duration / 3 + index * 34;
      swing.value = withRepeat(
        withSequence(withTiming(1, { duration: beat }), withTiming(0.15, { duration: beat })),
        -1,
        true,
      );
    } else {
      cancelAnimation(swing);
      swing.value = withTiming(0, timing());
    }
  }, [live, swing, index]);

  const style = useAnimatedStyle(() => ({
    height: MIN_H + swing.value * peak * (MAX_H - MIN_H),
  }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3, height: MAX_H },
  bar: { width: 3, borderRadius: 999 },
});
