import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { localDate } from "../api";
import { addDays, mondayOf, toLocalNoon, weekOf } from "../dates";

/** The week ribbon: seven day chips, chevrons to page weeks, the selection
 * highlight glides on a spring. Today wears a zest dot. */
export function WeekStrip({
  selected,
  onSelect,
  onToggleView,
}: {
  selected: string;
  onSelect: (date: string) => void;
  onToggleView: () => void;
}) {
  const [weekAnchor, setWeekAnchor] = useState(selected);
  const days = weekOf(weekAnchor);
  const today = localDate();
  const monthLabel = toLocalNoon(days[3]).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
  const todayInView = mondayOf(today) === mondayOf(weekAnchor);

  return (
    <div>
      <div className="flex items-baseline justify-between px-1">
        <span className="font-display text-sm font-bold tracking-tight text-ink">
          {monthLabel.split(" ")[0]} <span className="text-ink-muted">{monthLabel.split(" ")[1]}</span>
        </span>
        <span className="flex items-center gap-2">
          <AnimatePresence>
            {!todayInView && (
              <motion.button
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                onClick={() => {
                  setWeekAnchor(today);
                  onSelect(today);
                }}
                className="text-[10px] uppercase tracking-[0.18em] text-zest transition-transform active:scale-95"
              >
                back to today
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={onToggleView}
            aria-label="Open the month"
            title="Open the month"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted/70 transition-[color,transform] hover:text-ink active:scale-90"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1">
        <PagerButton
          dir={-1}
          onClick={() => setWeekAnchor((a) => addDays(a, -7))}
          label="Previous week"
        />
        {/* The week lives in a pressed tray; the chosen day pops out of it as a
            raised paper key and glides between slots on a spring. */}
        <div className="inset-well grid flex-1 grid-cols-7 gap-1 rounded-2xl bg-ink/[0.04] p-1">
          {days.map((d) => {
            const isSelected = d === selected;
            const isToday = d === today;
            const noon = toLocalNoon(d);
            return (
              <motion.button
                key={d}
                onClick={() => onSelect(d)}
                whileTap={{ scale: 0.92 }}
                aria-label={noon.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
                  isSelected ? "text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId="week-selected"
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="grain absolute inset-0 rounded-xl border border-rule/70 bg-surface shadow-soft"
                  />
                )}
                <span className="relative text-[9px] font-medium uppercase tracking-[0.14em]">
                  {noon.toLocaleDateString("en", { weekday: "narrow" })}
                </span>
                {/* Today reads bigger via a transform, so its cell keeps the same
                    layout height as the others — no stretched, empty row. */}
                <span
                  className={cn(
                    "relative font-display text-lg font-bold leading-none tracking-tight",
                    isToday && "origin-center scale-[1.3] font-black",
                    isToday && !isSelected && "text-zest",
                  )}
                >
                  {noon.getDate()}
                </span>
                <span
                  className={cn(
                    "relative h-1 w-1 rounded-full transition-colors",
                    isToday ? "bg-zest" : "bg-transparent",
                  )}
                />
              </motion.button>
            );
          })}
        </div>
        <PagerButton
          dir={1}
          onClick={() => setWeekAnchor((a) => addDays(a, 7))}
          label="Next week"
        />
      </div>
    </div>
  );
}

function PagerButton({
  dir,
  onClick,
  label,
}: {
  dir: -1 | 1;
  onClick: () => void;
  label: string;
}) {
  const Icon = dir === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-6 items-center justify-center rounded-lg text-ink-muted/60 transition-[color,transform] hover:text-ink active:scale-90"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
