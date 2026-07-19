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

/** Percent coordinates of a pointer event within `el`, clamped and rounded. */
export function pointerPct(e: React.PointerEvent, el: HTMLElement): [number, number] {
  const r = el.getBoundingClientRect();
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return [
    Math.round(clamp(((e.clientX - r.left) / r.width) * 100) * 100) / 100,
    Math.round(clamp(((e.clientY - r.top) / r.height) * 100) * 100) / 100,
  ];
}
