import {
  Canvas,
  Fill,
  Group,
  Path,
  Shader,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useDerivedValue, type SharedValue } from "react-native-reanimated";
import type { Stroke } from "@/lib/doodle";
import { hslToHex, type Palette } from "@/lib/theme";
import { GRID } from "../types";

/** How thick board ink is, in canvas px. It rides the canvas transform, so a
 * line drawn at any zoom keeps the same weight on the paper. */
const INK_WIDTH = 3;
const DOT_RADIUS = 1;
/** Every fifth dot is a bigger one. */
const MAJOR_EVERY = 5;
const MAJOR_RADIUS = 2.2;

/** The dot grid, as a shader rather than a pile of points.
 *
 * The board has no edges, so the grid cannot be a finite list of dots: it has
 * to exist wherever you happen to pan to. `mod` repeats the cell forever in
 * every direction, negative coordinates included, and it costs one draw call
 * no matter how far you travel. Drawn inside the canvas transform, so the dots
 * are in board coordinates and scale with the zoom.
 *
 * Two sizes, not one. A perfectly even field of dots tells you nothing: pan
 * across it and every frame looks like the last, so you cannot see how far you
 * went or how far out you are zoomed. A heavier dot every fifth cell is what
 * graph paper does, and it turns the same texture into something you can read
 * your position against. */
const GRID_SHADER = Skia.RuntimeEffect.Make(`
uniform float spacing;
uniform float radius;
uniform float majorEvery;
uniform float majorRadius;
uniform vec4 tint;

half4 main(vec2 p) {
  float minor = clamp(0.5 - (length(mod(p, spacing) - spacing * 0.5) - radius), 0.0, 1.0);
  float span = spacing * majorEvery;
  float major = clamp(0.5 - (length(mod(p, span) - span * 0.5) - majorRadius), 0.0, 1.0);
  float a = max(minor * 0.45, major) * tint.a;
  return half4(half3(tint.rgb), 1.0) * half(a);
}
`)!;

/** A palette colour as the `vec4` the shader wants. */
function rgba01(hslColor: string, a: number): number[] {
  const n = parseInt(hslToHex(hslColor).slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

export interface InkLayerProps {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  scale: SharedValue<number>;
  strokes: Stroke[];
  /** Points of the stroke in progress, in canvas coordinates. */
  live: SharedValue<[number, number][]>;
  /** Palette token the pen is currently loaded with. */
  liveInk: string;
  colors: Palette;
}

/** The paper and everything drawn straight onto it: the endless dot grid,
 * every committed stroke, and the line currently under the finger.
 *
 * This is the one layer that has to keep up with a hand moving at speed, so it
 * is the one layer on the GPU. The live stroke is built from a shared value
 * inside a worklet, which means a point reaches the screen without ever
 * crossing to JavaScript — the difference between ink and a slideshow.
 *
 * It never takes a touch. Drawing is captured by a plain view above it, so the
 * canvas can stay a pure function of the document. */
export default function InkLayer({
  tx,
  ty,
  scale,
  strokes,
  live,
  liveInk,
  colors,
}: InkLayerProps) {
  const transform = useDerivedValue(() => [
    { translateX: tx.value },
    { translateY: ty.value },
    { scale: scale.value },
  ]);

  // One path per ink colour rather than per stroke: a board with three hundred
  // strokes is still four draw calls.
  const inked = useMemo(() => {
    const byColor = new Map<string, SkPath>();
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      let path = byColor.get(s.color);
      if (!path) {
        path = Skia.Path.Make();
        byColor.set(s.color, path);
      }
      path.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) path.lineTo(s.points[i][0], s.points[i][1]);
    }
    return [...byColor].map(([token, path]) => ({
      path,
      color: hslToHex(colors[token as keyof Palette] ?? colors.ink),
    }));
  }, [strokes, colors]);

  const gridUniforms = useMemo(
    () => ({
      spacing: GRID,
      radius: DOT_RADIUS,
      majorEvery: MAJOR_EVERY,
      majorRadius: MAJOR_RADIUS,
      tint: rgba01(colors.rule, 0.75),
    }),
    [colors.rule],
  );

  const livePath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    const points = live.value;
    if (points.length > 1) {
      path.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) path.lineTo(points[i][0], points[i][1]);
    }
    return path;
  });

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group transform={transform}>
        <Fill>
          <Shader source={GRID_SHADER} uniforms={gridUniforms} />
        </Fill>
        {inked.map((ink) => (
          <Path
            key={ink.color}
            path={ink.path}
            color={ink.color}
            style="stroke"
            strokeWidth={INK_WIDTH}
            strokeCap="round"
            strokeJoin="round"
            opacity={0.85}
          />
        ))}
        <Path
          path={livePath}
          color={hslToHex(colors[liveInk as keyof Palette] ?? colors.ink)}
          style="stroke"
          strokeWidth={INK_WIDTH}
          strokeCap="round"
          strokeJoin="round"
          opacity={0.85}
        />
      </Group>
    </Canvas>
  );
}
