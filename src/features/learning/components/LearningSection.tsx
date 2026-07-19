import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Eyebrow, StampButton } from "@/components/surface";
import { useAuthStore } from "@/stores";
import { useLearningStore } from "../store";
import { useProgramSync } from "../useProgramSync";
import { ImportButton } from "./ImportButton";
import { FolderCard } from "./FolderCard";
import { ProgramHeader } from "./ProgramHeader";
import { ProjectTasks } from "./ProjectTasks";
import { Materials } from "./Materials";

export function LearningSection({ className }: { className?: string }) {
  const programs = useLearningStore((s) => s.programs);
  const setActive = useLearningStore((s) => s.setActive);
  const remove = useLearningStore((s) => s.remove);
  const syncError = useLearningStore((s) => s.syncError);

  // Pull + live-follow PocketBase so pushes from Claude Code appear here.
  useProgramSync();

  const [openId, setOpenId] = useState<string | null>(null);
  const open = programs.find((p) => p.id === openId) ?? null;

  if (programs.length === 0) {
    return (
      <section className={className}>
        {syncError && <SyncError message={syncError} />}
        <EmptyState />
      </section>
    );
  }

  // ── Detail view ────────────────────────────────────────────────────────────
  if (open) {
    return (
      <section className={cn("space-y-4", className)}>
        <StampButton onClick={() => setOpenId(null)} className="text-ink-muted">
          <ArrowLeft className="h-4 w-4" /> All paths
        </StampButton>

        {/* Sheets peeking from the top corners — you've opened the folder. */}
        <div className="relative">
          <span className="absolute -top-4 left-9 h-12 w-36 -rotate-[6deg] rounded-md border border-rule/70 bg-surface shadow-soft">
            <span className="absolute inset-x-3 top-2.5 h-px bg-rule/60" />
          </span>
          <span className="absolute -top-4 right-9 h-12 w-36 rotate-[6deg] rounded-md border border-rule/70 bg-surface shadow-soft">
            <span className="absolute inset-x-3 top-2.5 h-px bg-rule/60" />
          </span>
          <div className="relative z-10">
            <ProgramHeader program={open} />
          </div>
        </div>

        <ProjectTasks program={open} />
        <Materials program={open} />
        <div className="pt-2">
          <button
            onClick={() => {
              remove(open.id);
              setOpenId(null);
            }}
            className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-clay"
          >
            <Trash2 className="h-3.5 w-3.5" /> remove this path
          </button>
        </div>
      </section>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <section className={cn("space-y-6", className)}>
      {syncError && <SyncError message={syncError} />}

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        {programs.map((p) => (
          <FolderCard
            key={p.id}
            program={p}
            onOpen={() => {
              setActive(p.id);
              setOpenId(p.id);
            }}
          />
        ))}
        <ImportButton variant="card" />
      </div>
    </section>
  );
}

/** A failed sync must say so — an empty screen is not an acceptable error message. */
function SyncError({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-clay/40 bg-clay/10 p-4 text-[15px] text-ink">
      <span className="font-medium">Couldn&apos;t load your programs from the server.</span>{" "}
      <span className="text-ink-muted">They&apos;re safe — this is a connection or query problem.</span>
      <p className="mt-1 font-mono text-xs text-ink-muted">{message}</p>
    </div>
  );
}

function EmptyState() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <div className="rounded-[var(--radius-card)] border border-rule/70 bg-surface p-8 shadow-soft md:p-10">
      <Eyebrow>projects</Eyebrow>
      <h2 className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
        Bring a program to life.
      </h2>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
        Run the <span className="text-ink">learning-architect</span> skill in Claude to build a
        grounded, gated program, then import the bundle. DOOEY organizes it into a colour-coded
        card — a countdown to your next gate, the runway, and the sessions to tick off.
      </p>

      {!isAuthenticated && (
        <p className="mt-5 max-w-xl border-l-2 border-zest pl-4 text-[15px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Already pushed a program from Claude?</span> It
          lives in your account, not this browser — <span className="text-ink">sign in</span>{" "}
          (Account, in the dock below) to load it.
        </p>
      )}

      <div className="mt-7 max-w-xs">
        <ImportButton variant="card" />
      </div>
      <p className="mt-3 text-xs text-ink-muted/70">
        Select PLAN.md, SCHEDULE.md, TESTS.md, DAILY-TEMPLATE.md and calendar.ics.
      </p>
    </div>
  );
}
