import { cn } from "@/lib/cn";
import { Stamp } from "@/components/surface";
import { EditableText } from "@/components/editable";
import { Squiggle } from "@/components/icons/ornaments/Squiggle";
import { useProjectTasks } from "@/features/tasks";
import { categoryFor } from "../categories";
import { useLearningStore } from "../store";
import { daysBetween, projectStat, startOfToday } from "../metrics";
import type { GeneratedProgram } from "../types";
import { Runway } from "./Runway";

/** The program hero: a category-tinted card with the goal, a countdown, and the runway. */
export function ProgramHeader({ program }: { program: GeneratedProgram }) {
  const { data: tasks } = useProjectTasks(program.pbId);
  const updateProgram = useLearningStore((s) => s.updateProgram);
  const cat = categoryFor(program.goal);
  const m = projectStat(tasks ?? []);
  const target = m.nextGate ?? m.next;
  const complete = m.total > 0 && m.done === m.total;
  const rel = target?.dateObj ? daysBetween(startOfToday(), target.dateObj) : null;
  const overdue = rel != null && rel < 0;
  const { Icon } = cat;
  const folderBg = `color-mix(in srgb, hsl(var(${cat.varName})) 22%, hsl(var(--surface)))`;
  const folderBorder = `color-mix(in srgb, hsl(var(${cat.varName})) 45%, hsl(var(--surface)))`;

  return (
    <div
      style={{ background: folderBg, borderColor: folderBorder }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border p-6 shadow-soft md:p-8",
        "before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:z-10 before:h-px before:rounded-full before:bg-white/50 dark:before:bg-white/10",
      )}
    >
      <div className="relative">
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]",
            cat.chip,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <Stamp className={cat.stamp}>{cat.label}</Stamp>
      </div>

      <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink md:text-5xl">
        <EditableText
          ariaLabel="program title"
          value={program.goal}
          maxLength={60}
          placeholder="Untitled program"
          onCommit={(goal) => updateProgram(program.id, { goal })}
        />
      </h1>
      <Squiggle className={cn("mt-2 h-2 w-36", cat.text)} />
      <div className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
        <EditableText
          ariaLabel="why this matters"
          value={program.why ?? ""}
          maxLength={140}
          placeholder="Why does this matter? (click to add)"
          onCommit={(why) => updateProgram(program.id, { why })}
        />
      </div>

      {complete ? (
        <p className="mt-5 font-display text-xl tracking-tight text-leaf">
          Complete — {m.done} tasks, every gate cleared.
        </p>
      ) : rel != null && target ? (
        <div className="mt-6 flex items-end gap-4">
          <span className={cn("font-display text-6xl font-black leading-[0.8] tabular-nums", overdue ? "text-clay" : cat.text)}>
            {Math.abs(rel)}
          </span>
          <div className="pb-1">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              {rel === 0 ? "due today" : overdue ? "days overdue" : "days to go"}
            </div>
            <div className="mt-0.5 text-[15px] font-medium text-ink">
              {m.nextGate ? "⛳ " : ""}
              {target.title}
            </div>
            {target.topic && <div className="text-sm text-ink-muted">{target.topic}</div>}
          </div>
        </div>
      ) : target ? (
        <p className="mt-5 text-lg text-ink">
          Next up: <span className="text-ink-muted">{target.title}</span>
        </p>
      ) : null}

      {m.startDate && m.endDate && m.gates.length > 0 && (
        <Runway start={m.startDate} end={m.endDate} gates={m.gates} accent={cat.accent} />
      )}
      </div>
    </div>
  );
}
