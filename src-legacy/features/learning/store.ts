import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ClientResponseError } from "pocketbase";
import {
  canSync,
  deleteProgramFromPB,
  listProgramsFromPB,
  materializeProgram,
  saveProgramToPB,
  setProgramCoverInPB,
  updateProgramInPB,
} from "./api";
import type { FolderStyle, GeneratedProgram, ProgramFiles } from "./types";

/** Best guess at the program's short title from its files, for the folder tab. */
function deriveGoal(files: ProgramFiles): string {
  const plan = files["PLAN.md"] ?? "";
  const named = plan.match(/^#\s*Program:\s*(.+)$/m);
  if (named) return named[1].trim();
  const firstHeading = plan.match(/^#\s+(.+)$/m);
  if (firstHeading) return firstHeading[1].trim();
  const sched = (files["SCHEDULE.md"] ?? "").match(/^#\s+(.+)$/m);
  if (sched) return sched[1].replace(/\s*\(.*\)\s*$/, "").trim();
  return "Imported program";
}

/** The one-line reason, from PLAN.md's `Why:` line. */
function deriveWhy(files: ProgramFiles): string {
  const plan = files["PLAN.md"] ?? "";
  return plan.match(/^Why:\s*(.+)$/m)?.[1].trim() ?? "";
}

interface LearningState {
  programs: GeneratedProgram[];
  activeId: string | null;
  /** Last PocketBase sync failure, surfaced in the UI — never swallow this. */
  syncError: string | null;

  /** Import a program from skill-generated files, then materialize its tasks. */
  importProgram: (files: ProgramFiles) => Promise<void>;
  /** Edit the folder's title / why / dress-up. Persists to PocketBase when signed in. */
  updateProgram: (id: string, patch: { goal?: string; why?: string; folder?: FolderStyle }) => void;
  /** Set or clear the folder's cover picture (uploads to PocketBase). */
  setCover: (id: string, file: File | null) => Promise<void>;
  setActive: (id: string) => void;
  remove: (id: string) => void;
  /** Two-way sync with PocketBase: push local-only programs up, pull remote
   * ones down, and materialize any that haven't become tasks yet. */
  syncWithPB: () => Promise<void>;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => ({
      programs: [],
      activeId: null,
      syncError: null,

      updateProgram: (id, patch) => {
        set((s) => {
          const program = s.programs.find((p) => p.id === id);
          if (program?.pbId) {
            updateProgramInPB(program.pbId, patch).catch((e) =>
              console.warn("[learning] PocketBase update failed:", e),
            );
          }
          return {
            programs: s.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          };
        });
      },

      setCover: async (id, file) => {
        const program = get().programs.find((p) => p.id === id);
        if (!program?.pbId) return;
        const filename = await setProgramCoverInPB(program.pbId, file).catch((e) => {
          console.warn("[learning] cover upload failed:", e);
          return null;
        });
        if (filename === null) return;
        set((s) => ({
          programs: s.programs.map((p) =>
            p.id === id ? { ...p, cover: filename || undefined } : p,
          ),
        }));
      },

      importProgram: async (files) => {
        const program: GeneratedProgram = {
          id: crypto.randomUUID(),
          goal: deriveGoal(files),
          why: deriveWhy(files),
          files,
          createdAt: new Date().toISOString(),
        };
        const pbId = await saveProgramToPB(program).catch((e) => {
          console.warn("[learning] PocketBase sync failed:", e);
          return null;
        });
        if (pbId) {
          program.pbId = pbId;
          // Turn its sessions into real project tasks right away.
          await materializeProgram(program).catch((e) =>
            console.warn("[learning] materialize failed:", e),
          );
          program.materialized = true;
        }
        set((s) => ({
          programs: [program, ...s.programs],
          activeId: program.id,
        }));
      },

      setActive: (id) => set({ activeId: id }),

      remove: (id) =>
        set((s) => {
          const program = s.programs.find((p) => p.id === id);
          if (program?.pbId) {
            deleteProgramFromPB(program.pbId).catch((e) =>
              console.warn("[learning] PocketBase delete failed:", e),
            );
          }
          const programs = s.programs.filter((p) => p.id !== id);
          return {
            programs,
            activeId: s.activeId === id ? (programs[0]?.id ?? null) : s.activeId,
          };
        }),

      syncWithPB: async () => {
        if (!canSync()) return;
        const state = get();

        // Push local-only programs (no pbId) to PocketBase, capturing their new
        // ids, then materialize their sessions into tasks.
        const pushed = new Map<string, string>(); // localId -> pbId
        for (const p of state.programs) {
          if (p.pbId) continue;
          try {
            const pbId = await saveProgramToPB(p);
            if (pbId) {
              pushed.set(p.id, pbId);
              await materializeProgram({ ...p, pbId });
            }
          } catch (e) {
            console.warn("[learning] push to PocketBase failed:", e);
          }
        }

        // Pull everything back. A failure here must be visible: silently
        // treating it as "no programs" is how a broken query empties the app.
        let remote: Awaited<ReturnType<typeof listProgramsFromPB>>;
        try {
          remote = await listProgramsFromPB();
        } catch (e) {
          // An auto-cancelled pull isn't a failure — a newer request superseded it.
          if (e instanceof ClientResponseError && e.isAbort) return;
          const message = e instanceof Error ? e.message : String(e);
          console.error("[learning] pull from PocketBase failed:", e);
          set({ syncError: message });
          return;
        }
        set({ syncError: null });

        // Materialize any pulled program that predates the tasks model — a
        // one-time migration, guarded by the record's `materialized` flag.
        for (const r of remote) {
          if (!r.materialized) {
            try {
              await materializeProgram(r.program);
              r.program.materialized = true;
            } catch (e) {
              console.warn("[learning] migrate existing program failed:", e);
            }
          }
        }

        set((s) => {
          const programs = s.programs.map((p) =>
            pushed.has(p.id) ? { ...p, pbId: pushed.get(p.id), materialized: true } : p,
          );
          const known = new Set(programs.map((p) => p.pbId).filter(Boolean));
          for (const { program } of remote) {
            if (known.has(program.pbId)) continue;
            programs.push(program);
          }
          return {
            programs,
            activeId: s.activeId ?? programs[0]?.id ?? null,
          };
        });
      },
    }),
    {
      name: "dooey-learning",
      // Only the data is durable — transient sync errors must not survive a reload.
      partialize: (s) => ({ programs: s.programs, activeId: s.activeId }),
    },
  ),
);
