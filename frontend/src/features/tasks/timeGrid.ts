/** Shared geometry + math for the timeboxed day sheet and the week spread —
 * the same numbers as the web app's timeGrid. */

export const DAY_START = 6 * 60; // the sheet runs 6:00 –
export const DAY_END = 23 * 60; // – 23:00
export const SNAP = 15;
export const GUTTER = 48; // px, the ruler margin

/** Vertical scale, in px per minute — the +/- stepper nudges it by a factor.
 * 1px/min (a 60px hour) is the default. */
export const PX_MIN = 0.5;
export const PX_MAX = 2.8;
export const PX_DEFAULT = 1;
export const clampPx = (px: number) => Math.min(PX_MAX, Math.max(PX_MIN, px));

/** Zoom stops, geometric so each feels like the same step as the last.
 *
 * The grid is laid out in React — every tick, block and label is positioned
 * from `pxPerMin` in plain JS — so a *continuous* pinch means a full re-render
 * per frame, and the gesture ends up queued behind its own consequences. Eight
 * stops means a pinch commits a handful of times instead of sixty a second,
 * and each one is a clean relayout rather than one of sixty fighting.
 *
 * It is a real trade: the zoom steps rather than glides. Stepping crisply beats
 * gliding badly, and the stops are close enough that the hand reads it as
 * resistance rather than as stairs. */
export const PX_STOPS = [0.5, 0.65, 0.85, 1, 1.3, 1.7, 2.2, 2.8];

/** The stop nearest a raw pinch value. A worklet: the gesture that calls it
 * runs on the UI thread, and the whole point is not to hop off it. */
export function snapPx(px: number): number {
  "worklet";
  let best = PX_STOPS[0];
  for (let i = 1; i < PX_STOPS.length; i++) {
    if (Math.abs(PX_STOPS[i] - px) < Math.abs(best - px)) best = PX_STOPS[i];
  }
  return best;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const snap = (min: number) => Math.round(min / SNAP) * SNAP;

/** 450 → "7:30a", 720 → "12p" — desk-planner shorthand. */
export function fmtMin(min: number): string {
  const h24 = Math.floor(min / 60);
  const mm = min % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const ap = h24 < 12 ? "a" : "p";
  return mm ? `${h12}:${String(mm).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

/** Side-by-side lanes for overlapping blocks (greedy column packing per
 * overlap cluster, the classic calendar layout). */
export function layoutLanes(
  blocks: { id: string; start_min: number; dur_min: number }[],
): Map<string, { lane: number; lanes: number }> {
  const sorted = [...blocks].sort(
    (a, b) => a.start_min - b.start_min || b.dur_min - a.dur_min,
  );
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: string[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const id of cluster) result.get(id)!.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const t of sorted) {
    const end = t.start_min + t.dur_min;
    if (cluster.length && t.start_min >= clusterEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= t.start_min);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    result.set(t.id, { lane, lanes: 0 });
    cluster.push(t.id);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result;
}
