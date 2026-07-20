import { createContext, useContext } from "react";
/** Shared geometry + math for the timeboxed day sheet and the week spread. */

export const DAY_START = 6 * 60; // the sheet runs 6:00 –
export const DAY_END = 23 * 60; // – 23:00
export const SNAP = 15;
export const GUTTER = 48; // px, the ruler margin

/** Vertical scale, in px per minute — continuous, so pinch scales smoothly and
 * the +/- stepper nudges by a factor. 1px/min (a 60px hour) is the default. */
export const PX_MIN = 0.5;
export const PX_MAX = 2.8;
export const PX_DEFAULT = 1;
export const clampPx = (px: number) => Math.min(PX_MAX, Math.max(PX_MIN, px));

/** Live scale, provided by the calendar and read by every grid piece so a
 * zoom re-lays the whole sheet at once. */
const PxPerMinContext = createContext<number>(PX_DEFAULT);
export const PxPerMinProvider = PxPerMinContext.Provider;
export const usePxPerMin = () => useContext(PxPerMinContext);

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
