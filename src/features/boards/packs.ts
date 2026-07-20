import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores";
import type { Stroke } from "@/lib/doodle";
import type { DoodlePack, PackDoodle } from "./types";

const packKeys = { list: ["doodle_packs"] as const };

function toPack(r: RecordModel): DoodlePack {
  return { id: r.id, title: r.title, doodles: r.doodles ?? [] };
}

export function useDoodlePacks() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: packKeys.list,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("doodle_packs").getFullList({ sort: "created" });
      return records.map(toPack);
    },
  });
}

export function useCreatePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      pb
        .collection("doodle_packs")
        .create({ owner: pb.authStore.record!.id, title, doodles: [] }, { requestKey: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: packKeys.list }),
  });
}

export function useUpdatePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, doodles }: { id: string; doodles: PackDoodle[] }) =>
      pb.collection("doodle_packs").update(id, { doodles }, { requestKey: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: packKeys.list }),
  });
}

export function useDeletePack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pb.collection("doodle_packs").delete(id, { requestKey: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: packKeys.list }),
  });
}

/** Fit raw pad strokes (0–100 of the drawing pad) into the doodle's own
 * normalized space: x spans 0–100 of the bounding box, y keeps the same scale
 * so `aspect` (w/h) reproduces the drawing exactly at any width. */
export function normalizeDoodle(strokes: Stroke[]): { strokes: Stroke[]; aspect: number } {
  const pts = strokes.flatMap((s) => s.points);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  const bw = Math.max(maxX - minX, 2);
  const bh = Math.max(maxY - minY, 2);
  const k = 100 / bw;
  return {
    aspect: bw / bh,
    strokes: strokes.map((s) => ({
      color: s.color,
      points: s.points.map(([px, py]): [number, number] => [
        Math.round((px - minX) * k * 100) / 100,
        Math.round((py - minY) * k * 100) / 100,
      ]),
    })),
  };
}
