import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { daysBetween, startOfToday, type RunwayGate } from "../metrics";

const fmt = (d: Date) => d.toLocaleDateString("en", { month: "short", day: "numeric" });

/** Horizontal timeline: start → end, with a progress fill to today and gate ticks. */
export function Runway({
  start,
  end,
  gates,
  accent = "bg-ink",
}: {
  start: Date;
  end: Date;
  gates: RunwayGate[];
  accent?: string;
}) {
  const span = Math.max(1, daysBetween(start, end));
  const pos = (d: Date) => Math.max(0, Math.min(100, (daysBetween(start, d) / span) * 100));
  const today = startOfToday();
  const todayPos = pos(today);

  return (
    <div className="mt-7">
      <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        <span>{fmt(start)} · start</span>
        <span>{fmt(end)} · goal</span>
      </div>
      <div className="relative mt-3 h-4">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink/10" />
        <div
          className={cn("absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full", accent)}
          style={{ width: `${todayPos}%` }}
        />
        {gates.map((g) =>
          g.dateObj ? (
            <span
              key={g.key}
              title={`${g.label} · ${fmt(g.dateObj)}`}
              className={cn(
                "absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
                g.done ? "bg-leaf" : "bg-ink/40",
              )}
              style={{ left: `${pos(g.dateObj)}%` }}
            />
          ) : null,
        )}
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${todayPos}%` }}
        >
          <motion.span
            className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/30"
            animate={{ scale: [1, 2.3], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
          <span className="relative block h-4 w-4 rounded-full border-[3px] border-surface bg-ink shadow-soft" />
        </span>
      </div>
    </div>
  );
}
