import { useQuery } from "@tanstack/react-query";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import type { Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";

export type FolderHue = "sky" | "zest" | "leaf" | "clay" | "honey";

/** A learning program as the mobile app needs it: the goal/why, the folder
 * dress-up, and the source files kept as reference. Its actual work lives in
 * ordinary tasks with `project` pointing here. */
export interface Program {
  id: string;
  goal: string;
  why: string;
  files: Record<string, string>;
  hue: FolderHue;
  cover: string; // stored filename, or ""
  created: string;
}

const HUES: FolderHue[] = ["sky", "zest", "leaf", "clay", "honey"];

function toProgram(r: RecordModel, index: number): Program {
  const folder = (r.folder ?? {}) as { hue?: FolderHue };
  return {
    id: r.id,
    goal: r.goal,
    why: r.why ?? "",
    files: r.files ?? {},
    // No dress-up chosen yet → rotate through the category hues like the web.
    hue: folder.hue ?? HUES[index % HUES.length],
    cover: (r.cover as string) ?? "",
    created: r.created,
  };
}

export function programCoverUrl(id: string, filename: string): string {
  return `${pb.baseURL}/api/files/learning_programs/${id}/${encodeURIComponent(filename)}`;
}

export function usePrograms() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["programs"] as const,
    enabled: isAuthenticated,
    queryFn: async () => {
      const records = await pb.collection("learning_programs").getFullList({ sort: "-created" });
      return records.map(toProgram);
    },
  });
}

export function useProgram(id: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ["programs", id] as const,
    enabled: isAuthenticated,
    queryFn: async () => toProgram(await pb.collection("learning_programs").getOne(id), 0),
  });
}

/** The folder's accent color from the active palette. */
export function hueColor(hue: FolderHue, colors: Palette): string {
  return colors[hue];
}
