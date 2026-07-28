import { StyleSheet, View } from "react-native";
import { usePalette } from "@/stores/theme";
import { busiestSide, paintOf } from "../anatomy";
import { useWorkoutPrefs } from "../store";
import { WeekBody } from "./WeekBody";

/** An anatomical figure with an exercise's muscles shaded — the "which muscle"
 * companion to the motion GIF.
 *
 * It used to pick one side and drop every muscle on the other, so a squat
 * showed the quads and quietly forgot the glutes and hamstrings. Now `both`
 * shows the pair wherever there is room for it, and the single-sided form —
 * the muscle-group chips, at thumbnail size — turns to whichever side the
 * primary muscles are actually on.
 *
 * `tint` paints the shading in a routine's focus hue; left off, it's clay. */
export function MuscleMap({
  targets,
  secondary = [],
  both = false,
  scale = 0.55,
  tint,
}: {
  targets: string[];
  secondary?: string[];
  /** Show front and back together. The exercise sheet has the room; the
   * thumbnail chips don't. */
  both?: boolean;
  scale?: number;
  tint?: string;
}) {
  const colors = usePalette();
  const gender = useWorkoutPrefs((s) => s.gender);
  const painted = paintOf(targets, secondary, tint ?? colors.clay);

  if (both) {
    return (
      <View style={styles.row} pointerEvents="none">
        <WeekBody painted={painted} gender={gender} side="front" scale={scale} />
        <WeekBody painted={painted} gender={gender} side="back" scale={scale} />
      </View>
    );
  }
  return <WeekBody painted={painted} gender={gender} side={busiestSide(painted)} scale={scale} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
});
