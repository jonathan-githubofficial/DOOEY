import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { localDate, useMonthOpenCounts } from "../api";
import { addDays, toLocalNoon } from "../dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** The month grid: every day at a glance, with dots for open tasks (zest) and
 * learning sessions (their category hue). Tap a day — the page below flips. */
export function MonthView({
  month,
  onMonth,
  selected,
  onSelect,
  onToggleView,
  sessionDots,
}: {
  month: string; // YYYY-MM
  onMonth: (m: string) => void;
  selected: string;
  onSelect: (date: string) => void;
  onToggleView: () => void;
  sessionDots: Record<string, string[]>;
}) {
  const { data: counts = {} } = useMonthOpenCounts(month);
  const today = localDate();

  const first = `${month}-01`;
  const firstNoon = toLocalNoon(first);
  const mondayOffset = (firstNoon.getDay() + 6) % 7;
  const daysInMonth = new Date(firstNoon.getFullYear(), firstNoon.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);
  const gridStart = addDays(first, -mondayOffset);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  const shiftMonth = (delta: number) => {
    const d = new Date(firstNoon);
    d.setMonth(d.getMonth() + delta);
    onMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <span className="font-display text-sm font-bold tracking-tight text-ink">
          {firstNoon.toLocaleDateString("en", { month: "long" })}{" "}
          <span className="text-ink-muted">{firstNoon.getFullYear()}</span>
        </span>
        <span className="flex items-center gap-1">
          <HeaderButton label="Previous month" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </HeaderButton>
          <HeaderButton label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </HeaderButton>
          <HeaderButton label="Fold back to the week" onClick={onToggleView}>
            <ChevronUp className="h-4 w-4" />
          </HeaderButton>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 px-1.5">
        {WEEKDAYS.map((w, i) => (
          <span
            key={i}
            className="pb-1 text-center text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted"
          >
            {w}
          </span>
        ))}
      </div>
      <div className="inset-well grid grid-cols-7 gap-0.5 rounded-2xl bg-ink/[0.04] p-1">
        {cells.map((d) => {
          const inMonth = d.startsWith(month);
          const isSelected = d === selected;
          const isToday = d === today;
          const taskDots = Math.min(counts[d] ?? 0, 3);
          const sessions = (sessionDots[d] ?? []).slice(0, 2);
          return (
            <motion.button
              key={d}
              onClick={() => onSelect(d)}
              whileTap={{ scale: 0.92 }}
              aria-label={toLocalNoon(d).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
              aria-pressed={isSelected}
              className={cn(
                "relative flex h-11 flex-col items-center justify-center rounded-xl transition-colors",
                inMonth ? "text-ink" : "text-ink-muted/40",
                !isSelected && "hover:bg-ink/[0.04]",
              )}
            >
              {isSelected && (
                <motion.span
                  layoutId="month-selected"
                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  className="grain absolute inset-0 rounded-xl border border-rule/70 bg-surface shadow-soft"
                />
              )}
              <span
                className={cn(
                  "relative font-display text-[15px] font-bold leading-none tracking-tight",
                  isToday && "text-zest",
                )}
              >
                {Number(d.slice(8))}
              </span>
              <span className="relative mt-1 flex h-1 items-center gap-0.5">
                {Array.from({ length: taskDots }).map((_, i) => (
                  <span key={`t${i}`} className="h-1 w-1 rounded-full bg-zest/80" />
                ))}
                {sessions.map((accent, i) => (
                  <span key={`s${i}`} className={cn("h-1 w-1 rounded-full", accent)} />
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted/70 transition-[color,transform] hover:text-ink active:scale-90"
    >
      {children}
    </button>
  );
}
