// Freehand-doodle primitives, shared shape with the web app: points are % of
// the drawing surface so strokes scale with it, and records written here
// render identically there (and vice versa).

export interface Stroke {
  color: string; // palette token name: "ink" | "zest" | "sky" | "clay"
  points: [number, number][];
}

export const INK_COLORS = ["zest", "sky", "clay", "ink"] as const;
export type InkColor = (typeof INK_COLORS)[number];

export function strokePath(points: [number, number][]): string {
  return "M " + points.map((p) => `${p[0]} ${p[1]}`).join(" L ");
}

/** Percent coordinates of a touch within a pad of `size` pixels, clamped and
 * rounded — the RN counterpart of the web's pointerPct. */
export function touchPct(x: number, y: number, size: number): [number, number] {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return [
    Math.round(clamp((x / size) * 100) * 100) / 100,
    Math.round(clamp((y / size) * 100) * 100) / 100,
  ];
}
