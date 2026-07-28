import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { paintOf } from "../anatomy";
import { TWIN_FOOT, TWIN_HEAD } from "../card-metrics";
import { useWorkoutPrefs } from "../store";
import { WeekBody } from "./WeekBody";

/** Front and back of the figure with everything a routine trains shaded in the
 * card's own hue. Two views because half the muscles a split hits don't show
 * from the front — a pull day looks like an untouched body otherwise.
 *
 * Both at the same size, always front then back, so the same view sits in the
 * same place on every card and a wall of them can be compared at a glance.
 *
 * `secondary` is what the movements also work, washed out: a chest day should
 * read as chest with the shoulders and triceps faintly along for the ride, not
 * as four muscles of equal billing. */
export function MuscleTwin({
  targets,
  secondary = [],
  tint,
  scale = 0.15,
  style,
}: {
  targets: string[];
  secondary?: string[];
  tint: string;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const gender = useWorkoutPrefs((s) => s.gender);
  if (targets.length === 0 && secondary.length === 0) return null;

  const painted = paintOf(targets, secondary, tint);
  return (
    <View style={[styles.row, crop(scale), style]} pointerEvents="none">
      <WeekBody painted={painted} gender={gender} side="front" scale={scale} />
      <WeekBody painted={painted} gender={gender} side="back" scale={scale} />
    </View>
  );
}

/** Take back the empty strips the artwork carries over its head and under its
 * feet, so the pair measures the figures rather than their boxes and whatever
 * sits above or below it lands where the numbers say. See {@link TWIN_HEAD}.
 *
 * The dead margin down each side is left alone on purpose: it's what holds the
 * two figures apart, and it scales with them. */
function crop(scale: number) {
  return { marginTop: -400 * scale * TWIN_HEAD, marginBottom: -400 * scale * TWIN_FOOT };
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
});
