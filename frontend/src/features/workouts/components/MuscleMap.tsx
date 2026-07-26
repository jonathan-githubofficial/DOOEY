import { StyleSheet, View } from "react-native";
import Body from "react-native-body-highlighter";
import { alpha } from "@/lib/theme";
import { usePalette } from "@/stores/theme";
import { bodyData, MUSCLE_SLUG, type Placed } from "../anatomy";
import type { Gender } from "../store";

/** An anatomical figure (male/female per prefs) with the exercise's worked
 * muscles shaded — the "which muscle" companion to the motion GIF. The view
 * flips to the back when the primary muscle lives there. Cardio-only exercises
 * (no mapped muscle) just show the plain figure. `tint` paints the shading in a
 * routine's focus hue; left off, it's the standard highlight red. */
export function MuscleMap({
  targets,
  gender,
  scale = 0.55,
  tint,
}: {
  targets: string[];
  gender: Gender;
  scale?: number;
  tint?: string;
}) {
  const colors = usePalette();
  const fill = tint ?? colors.clay;
  const placed = targets.map((t) => MUSCLE_SLUG[t]).filter((p): p is Placed => !!p);
  const side = placed[0]?.side ?? "front";
  // Shade every worked muscle that shows on the chosen side.
  const worked = new Map(placed.filter((p) => p.side === side).map((p) => [p.slug, fill]));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Body
        data={bodyData(worked, alpha(colors.ink, 0.13))}
        gender={gender}
        side={side}
        scale={scale}
        border={alpha(colors.ink, 0.25)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
