// The week ribbon (unit 5.1, ported from src-legacy/features/tasks/components/WeekStrip.tsx onto
// Lynx). Seven day chips in a pressed tray, chevrons to page weeks, a "back to today" shortcut when
// the viewed week drifts off today. Unit 4.1 deferred this shelf (and MonthView) to 5.1; it now
// lives in BOTH the Today planner shelf and, via MonthView's sibling, the calendar space.
//
// DROPPED (recorded BROOM): `motion`/`AnimatePresence`. The layoutId="week-selected" sliding
// highlight -> a per-chip conditional highlight <view> (the SPEC-sanctioned instant swap: Lynx has
// no shared-element layout animation, and left/width transitions across a flex tray don't hold).
// whileTap scale -> the native `active:scale-95` press (the shipped L2/dock press path). The "back
// to today" AnimatePresence -> a conditional mount with a CSS fade-in class. `lucide-react`
// (ChevronDown/Left/Right) -> the L2 icon set (unit 2.4). Elements: <div>/<button> -> <view
// bindtap>, <span> -> <text> (each <text> carries its own colour + size; <text> does not inherit).
import { useState } from "react";

import { ChevronDown, ChevronLeft, ChevronRight } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { localDate } from "../api";
import { addDays, mondayOf, toLocalNoon, weekOf } from "../dates";

/** The week ribbon: seven day chips, chevrons to page weeks, today wears a zest dot. */
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
    <view data-testid="week-strip">
      <view className="flex items-baseline justify-between px-1">
        <text className="font-display text-sm font-bold tracking-tight text-ink">
          {monthLabel.split(" ")[0]}{" "}
          <text className="font-display text-sm font-bold tracking-tight text-ink-muted">
            {monthLabel.split(" ")[1]}
          </text>
        </text>
        <view className="flex items-center gap-2">
          {!todayInView && (
            <view
              bindtap={() => {
                setWeekAnchor(today);
                onSelect(today);
              }}
              accessibility-label="back to today"
              accessibility-traits="button"
              data-testid="week-strip-today"
              className="animate-enter-fade active:scale-95"
            >
              <text className="text-[10px] uppercase tracking-[0.18em] text-zest">back to today</text>
            </view>
          )}
          <view
            bindtap={onToggleView}
            accessibility-label="Open the month"
            accessibility-traits="button"
            data-testid="week-strip-tomonth"
            className="flex h-7 w-7 items-center justify-center rounded-lg active:scale-90"
          >
            <ChevronDown className="h-4 w-4 text-ink-muted" />
          </view>
        </view>
      </view>

      <view className="mt-2 flex items-center gap-1">
        <PagerButton dir={-1} onClick={() => setWeekAnchor((a) => addDays(a, -7))} label="Previous week" />
        {/* The week lives in a pressed tray; the chosen day pops out as a raised paper key. */}
        <view className="inset-well flex flex-1 gap-1 rounded-2xl bg-ink/[0.04] p-1">
          {days.map((d) => {
            const isSelected = d === selected;
            const isToday = d === today;
            const noon = toLocalNoon(d);
            return (
              <view
                key={d}
                bindtap={() => onSelect(d)}
                accessibility-label={noon.toLocaleDateString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                accessibility-traits="button"
                accessibility-value={isSelected ? "selected" : undefined}
                data-testid="week-strip-day"
                className="relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 active:scale-95"
              >
                {isSelected && (
                  <view className="grain absolute inset-0 rounded-xl border border-rule/70 bg-surface shadow-soft" />
                )}
                <text
                  className={cn(
                    "relative text-[9px] font-medium uppercase tracking-[0.14em]",
                    isSelected ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {noon.toLocaleDateString("en", { weekday: "narrow" })}
                </text>
                {/* Today reads bigger via a transform, so its cell keeps the same layout height. */}
                <text
                  className={cn(
                    "relative font-display text-lg font-bold leading-none tracking-tight",
                    isToday && "origin-center scale-[1.3] font-black",
                    isToday && !isSelected ? "text-zest" : "text-ink",
                  )}
                >
                  {noon.getDate()}
                </text>
                <view
                  className={cn(
                    "relative h-1 w-1 rounded-full",
                    isToday ? "bg-zest" : "bg-transparent",
                  )}
                />
              </view>
            );
          })}
        </view>
        <PagerButton dir={1} onClick={() => setWeekAnchor((a) => addDays(a, 7))} label="Next week" />
      </view>
    </view>
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
  return (
    <view
      bindtap={onClick}
      accessibility-label={label}
      accessibility-traits="button"
      className="flex h-9 w-6 items-center justify-center rounded-lg active:scale-90"
    >
      {dir === -1 ? (
        <ChevronLeft className="h-4 w-4 text-ink-muted" />
      ) : (
        <ChevronRight className="h-4 w-4 text-ink-muted" />
      )}
    </view>
  );
}
