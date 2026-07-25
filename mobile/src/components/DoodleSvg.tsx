import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { strokePath, type Stroke } from "@/lib/doodle";
import type { Palette } from "@/lib/theme";
import { usePalette } from "@/stores/theme";

/** Render strokes over whatever this is absolutely positioned against.
 * Widths live in viewBox units, so the drawing scales as one piece — right
 * for square art shown at many sizes (the avatar, the editor pad). `tint`
 * overrides every stroke's own ink, for when the drawing is being used as a
 * card's watermark rather than shown as itself. */
export function DoodleSvg({
  strokes,
  strokeWidth = 1.8,
  tint,
  opacity = 0.85,
}: {
  strokes: Stroke[];
  strokeWidth?: number;
  tint?: string;
  opacity?: number;
}) {
  const colors = usePalette();
  if (strokes.length === 0) return null;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      {strokes.map((s, i) => (
        <Path
          key={i}
          d={strokePath(s.points)}
          fill="none"
          stroke={tint ?? colors[s.color as keyof Palette] ?? colors.ink}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      ))}
    </Svg>
  );
}
