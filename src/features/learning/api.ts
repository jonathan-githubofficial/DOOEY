import { pb } from "@/lib/pb";
import { parseSchedule } from "./parse";
import type { FolderStyle, GeneratedProgram, ProgramFiles } from "./types";

// ── PocketBase mirror ──────────────────────────────────────────────────────
// Programs live server-side; their sessions are materialized into real tasks
// (project tasks) so the whole app treats project work like any other task.

export function canSync(): boolean {
  return pb.authStore.isValid;
}

/** Mirror a program to PocketBase; returns the new record id, or null if not signed in. */
export async function saveProgramToPB(program: GeneratedProgram): Promise<string | null> {
  if (!canSync()) return null;
  const record = await pb.collection("learning_programs").create({
    owner: pb.authStore.record?.id,
    goal: program.goal,
    why: program.why ?? "",
    files: program.files,
  });
  return record.id;
}

/** Persist an edit to the folder's title / why / dress-up, or its files. */
export async function updateProgramInPB(
  pbId: string,
  patch: { goal?: string; why?: string; files?: ProgramFiles; folder?: FolderStyle; materialized?: boolean },
): Promise<void> {
  if (!canSync()) return;
  await pb.collection("learning_programs").update(pbId, patch, { requestKey: null });
}

/** Swap the folder's cover picture (or clear it with null); returns the stored
 * filename. Requires the program to be mirrored (signed in). */
export async function setProgramCoverInPB(pbId: string, file: File | null): Promise<string> {
  const record = await pb
    .collection("learning_programs")
    .update(pbId, { cover: file }, { requestKey: null });
  return (record.cover as string) ?? "";
}

export function programCoverUrl(pbId: string, filename: string): string {
  return `${pb.baseURL}/api/files/learning_programs/${pbId}/${encodeURIComponent(filename)}`;
}

/** Per-session timebox carried over from the old layout map, if any. */
export type SessionTimebox = Record<string, { start_min?: number; dur_min?: number } | undefined>;

/**
 * Turn a program's SCHEDULE.md sessions into real project tasks — once. Skips
 * any session that already has a task (matched by `session_key`), so importing
 * or re-syncing never duplicates them. Carries over each session's done state
 * and any timebox it had, then flags the program materialized.
 */
export async function materializeProgram(
  program: GeneratedProgram,
  progress: Record<string, boolean> = {},
  timeboxes: SessionTimebox = {},
): Promise<void> {
  const pbId = program.pbId;
  if (!canSync() || !pbId) return;

  const groups = parseSchedule(program.files["SCHEDULE.md"]);
  const sessions = groups.flatMap((g) => g.sessions);

  // Which sessions already became tasks (idempotency across re-syncs / tabs).
  const existing = await pb.collection("tasks").getFullList({
    filter: pb.filter("project = {:id}", { id: pbId }),
    fields: "session_key",
  });
  const have = new Set(existing.map((r) => r.session_key as string).filter(Boolean));
  const ownerId = pb.authStore.record!.id;
  const now = new Date().toISOString();

  for (const s of sessions) {
    if (s.key && have.has(s.key)) continue;
    const dateMs = s.date ? new Date(`${s.date}T00:00:00.000Z`).getTime() : 0;
    const done = progress[s.key] ?? s.doneInFile;
    const tb = timeboxes[s.key] ?? {};
    await pb.collection("tasks").create(
      {
        owner: ownerId,
        title: s.label,
        description: s.topic,
        due_date: s.date ? new Date(`${s.date}T00:00:00.000Z`) : "",
        done_at: done ? now : "",
        gate: s.isGate,
        project: pbId,
        session_key: s.key,
        start_min: tb.start_min ?? 0,
        dur_min: tb.dur_min || 60,
        sort_order: dateMs + s.line,
      },
      { requestKey: null },
    );
  }

  await updateProgramInPB(pbId, { materialized: true });
}

/** Delete server-side too — cascade removes the project's tasks with it. */
export async function deleteProgramFromPB(pbId: string): Promise<void> {
  if (!canSync()) return;
  await pb.collection("learning_programs").delete(pbId);
}

/** A program fetched from PocketBase, plus the legacy per-session state still
 * needed to migrate it into tasks the first time. */
export interface HydratedProgram {
  program: GeneratedProgram;
  materialized: boolean;
  /** Legacy session progress + timeboxes, used once at materialization. */
  progress: Record<string, boolean>;
  timeboxes: SessionTimebox;
}

export async function listProgramsFromPB(): Promise<HydratedProgram[]> {
  if (!canSync()) return [];
  const records = await pb.collection("learning_programs").getFullList({ sort: "-created" });
  return records.map((r) => {
    const layout = (r.layout ?? {}) as Record<string, { start_min?: number; dur_min?: number }>;
    return {
      program: {
        id: r.id,
        pbId: r.id,
        goal: r.goal,
        why: r.why ?? "",
        files: r.files ?? {},
        createdAt: r.created,
        folder: (r.folder ?? undefined) as FolderStyle | undefined,
        cover: (r.cover as string) || undefined,
        materialized: !!r.materialized,
      },
      materialized: !!r.materialized,
      progress: (r.progress ?? {}) as Record<string, boolean>,
      timeboxes: layout,
    };
  });
}
