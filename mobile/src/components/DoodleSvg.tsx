import { StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { strokePath, type Stroke } from "@/lib/doodle";
import type { Palette } from "@/lib/theme";
import { usePalette } from "@/stores/theme";

/** Render strokes over whatever this is absolutely positioned against.
 * Widths live in viewBox units, so the drawing scales as one piece — right
 * for square art shown at many sizes (the avatar, the editor pad). */
export function DoodleSvg({ strokes, strokeWidth = 1.8 }: { strokes: Stroke[]; strokeWidth?: number }) {
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
          stroke={colors[s.color as keyof Palette] ?? colors.ink}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      ))}
    </Svg>
  );
}
