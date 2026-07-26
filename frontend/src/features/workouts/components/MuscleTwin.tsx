import { StyleSheet, View } from "react-native";
import { useWorkoutPrefs } from "../store";
import { WeekBody } from "./WeekBody";

/** Front and back of the figure with everything a routine trains shaded in the
 * card's own hue. Two views because half the muscles a split hits don't show
 * from the front — a pull day looks like an untouched body otherwise. */
export function MuscleTwin({
  targets,
  tint,
  scale = 0.15,
}: {
  targets: string[];
  tint: string;
  scale?: number;
}) {
  const gender = useWorkoutPrefs((s) => s.gender);
  if (targets.length === 0) return null;

  const painted = new Map(targets.map((t) => [t, tint]));
  return (
    <View style={styles.row} pointerEvents="none">
      <WeekBody painted={painted} gender={gender} side="front" scale={scale} />
      <WeekBody painted={painted} gender={gender} side="back" scale={scale} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
});
