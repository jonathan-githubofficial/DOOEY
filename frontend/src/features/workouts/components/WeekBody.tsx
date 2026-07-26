import { StyleSheet, View } from "react-native";
import Body, { type Slug } from "react-native-body-highlighter";
import { alpha } from "@/lib/theme";
import { usePalette } from "@/stores/theme";
import { bodyData, MUSCLE_SLUG } from "../anatomy";
import type { Gender } from "../store";

/** The figure in the week panel: every muscle you trained this week, each in
 * the colour of the session that hit it. Unlike `MuscleMap` — which shades one
 * exercise in one tint — this paints many muscles in many hues at once, and the
 * caller drives which way it faces so the panel can flip it. */
export function WeekBody({
  painted,
  gender,
  side,
  scale,
}: {
  painted: Map<string, string>;
  gender: Gender;
  side: "front" | "back";
  scale: number;
}) {
  const colors = usePalette();

  // One entry per slug that shows on this side. A slug two muscles map onto
  // (lats and upper back both land on "upper-back") keeps the first colour
  // written — Body renders one fill per slug regardless.
  const bySlug = new Map<Slug, string>();
  for (const [target, color] of painted) {
    const placed = MUSCLE_SLUG[target];
    if (!placed || placed.side !== side) continue;
    if (!bySlug.has(placed.slug)) bySlug.set(placed.slug, color);
  }
  const resting = alpha(colors.ink, 0.13);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Body
        data={bodyData(bySlug, resting)}
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
