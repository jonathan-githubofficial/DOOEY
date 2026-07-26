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

/** Remove any part of any stroke within `radius` of (x, y). A stroke erased in
 * the middle splits into two — this is what makes it feel like a real eraser
 * instead of an all-or-nothing "clear". Runs of a single leftover point (which
 * can't render a line) are dropped.
 *
 * Coordinates are whatever space the strokes are in: percent on a drawing pad,
 * canvas pixels on a board. */
export function eraseNear(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const result: Stroke[] = [];
  for (const s of strokes) {
    let run: [number, number][] = [];
    for (const p of s.points) {
      if (Math.hypot(p[0] - x, p[1] - y) > radius) {
        run.push(p);
      } else {
        if (run.length > 1) result.push({ color: s.color, points: run });
        run = [];
      }
    }
    if (run.length > 1) result.push({ color: s.color, points: run });
  }
  return result;
}
