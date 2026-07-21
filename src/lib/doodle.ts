// Freehand-doodle primitives shared by the task scrapbook and the avatar
// editor. Points are % of the drawing surface so strokes scale with it.
// The renderer lives in src/components/doodle-svg.tsx.

export interface Stroke {
  color: string; // CSS token name: "ink" | "zest" | "sky" | "clay"
  points: [number, number][];
}

export const INK_COLORS = ["zest", "sky", "clay", "ink"] as const;
export type InkColor = (typeof INK_COLORS)[number];

export function strokePath(points: [number, number][]): string {
  return "M " + points.map((p) => `${p[0]} ${p[1]}`).join(" L ");
}
