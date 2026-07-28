import { StyleSheet, View } from "react-native";
import Body, { type Slug } from "react-native-body-highlighter";
import { alpha } from "@/lib/theme";
import { usePalette } from "@/stores/theme";
import { bodyData, paintSide, SECONDARY_STRENGTH, type Paint, type Side } from "../anatomy";
import type { Gender } from "../store";

/** One view of the figure with muscles shaded.
 *
 * Every figure in the gym goes through here, so they cannot disagree about
 * where a muscle lives or how hard a secondary one is washed. The caller drives
 * which way it faces, and supplies a colour per muscle — one tint for a single
 * routine, many for a week of sessions. */
export function WeekBody({
  painted,
  gender,
  side,
  scale,
}: {
  painted: Map<string, Paint>;
  gender: Gender;
  side: Side;
  scale: number;
}) {
  const colors = usePalette();

  /** Unworked muscle. The outline is kept under this weight on purpose. */
  const RESTING = alpha(colors.ink, 0.13);

  const worked = new Map<Slug, string>();
  for (const [slug, paint] of paintSide(painted, side)) {
    worked.set(slug, paint.strong ? paint.color : alpha(paint.color, SECONDARY_STRENGTH));
  }

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Body
        data={bodyData(worked, RESTING)}
        gender={gender}
        side={side}
        scale={scale}
        // Lighter than the body it encloses, not twice its weight. The library
        // hard-codes a 2-unit stroke, so at the sizes these figures are drawn
        // an outline heavier than the fill turns the whole thing into a
        // wireframe and the shading stops being the thing you notice.
        border={alpha(colors.ink, 0.14)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
