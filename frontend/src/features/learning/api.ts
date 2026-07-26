import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import type { Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { taskKeys } from "@/features/tasks/api";
import { parseSchedule } from "./parse";

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
  /** Whether this program's sessions have already become tasks. */
  materialized: boolean;
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
    materialized: !!r.materialized,
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

/**
 * Turn a program's SCHEDULE.md sessions into real tasks — once.
 *
 * A program's work is meant to be ordinary tasks: one `tasks` record per
 * session, carrying `project`, `gate` and `session_key`, so Planner, timeboxing
 * and the task page all treat program work like any other work.
 *
 * Skips any session that already has a task, matched on `session_key`, so a
 * re-sync or a second device never duplicates them. The record's `materialized`
 * flag is the outer guard; the per-session check is the one that actually makes
 * it safe.
 */
export async function materializeProgram(id: string, files: Record<string, string>) {
  const sessions = parseSchedule(files["SCHEDULE.md"]).flatMap((g) => g.sessions);
  if (sessions.length === 0) {
    await pb.collection("learning_programs").update(id, { materialized: true });
    return;
  }

  const existing = await pb.collection("tasks").getFullList({
    filter: pb.filter("project = {:id}", { id }),
    fields: "session_key",
  });
  const have = new Set(existing.map((r) => r.session_key as string).filter(Boolean));
  const owner = pb.authStore.record!.id;
  const now = new Date().toISOString();

  for (const s of sessions) {
    if (s.key && have.has(s.key)) continue;
    const dateMs = s.date ? new Date(`${s.date}T00:00:00.000Z`).getTime() : 0;
    await pb.collection("tasks").create(
      {
        owner,
        title: s.label,
        description: s.topic,
        due_date: s.date ? new Date(`${s.date}T00:00:00.000Z`) : "",
        done_at: s.doneInFile ? now : "",
        gate: s.isGate,
        project: id,
        session_key: s.key,
        start_min: 0,
        dur_min: 60,
        sort_order: dateMs + s.line,
      },
      { requestKey: null },
    );
  }

  await pb.collection("learning_programs").update(id, { materialized: true });
}

/**
 * Convert any program whose sessions have not become tasks yet.
 *
 * This used to run in the web app, which meant a program pushed by
 * `npm run push-program` created the program record and no tasks until you
 * opened a browser. It runs here now, so the push is end to end.
 *
 * Mount it once, where programs are listed.
 */
export function useMaterializePrograms(programs: Program[] | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    const pending = (programs ?? []).filter((p) => !p.materialized);
    if (pending.length === 0) return;
    let live = true;
    void (async () => {
      for (const p of pending) {
        try {
          await materializeProgram(p.id, p.files);
        } catch (e) {
          // One bad SCHEDULE.md must not stop the others, and the flag stays
          // false so the next sync tries again.
          console.warn("[learning] materialize failed for", p.goal, e);
        }
      }
      if (!live) return;
      await qc.invalidateQueries({ queryKey: ["programs"] });
      await qc.invalidateQueries({ queryKey: taskKeys.all });
    })();
    return () => {
      live = false;
    };
  }, [programs, qc]);
}

/** The folder's accent color from the active palette. */
export function hueColor(hue: FolderHue, colors: Palette): string {
  return colors[hue];
}
