// The month grid (unit 5.1, ported from src-legacy/features/tasks/components/MonthView.tsx onto
// Lynx). Every day at a glance, with dots for open tasks (zest, from useMonthOpenCounts) and
// learning sessions (their category hue, from the `sessionDots` prop). Unit 4.1 deferred this shelf
// to 5.1; it renders in both the Today planner shelf and the calendar month view.
//
// sessionDots: callers pass {} at L5 -- useMonthProjectDots lives in features/learning (L6), not
// ported yet; no learning programs exist until L6, so session dots are empty anyway. L6 rewires the
// real hook at each call site.
//
// DROPPED (recorded BROOM): `motion` (layoutId="month-selected" sliding highlight + whileTap) -> a
// per-cell conditional highlight <view> (instant swap; Lynx has no shared-element layout animation)
// + native `active:scale-95`. `lucide-react` (ChevronLeft/Right/Up) -> the L2 icon set (unit 2.4).
// CSS `grid grid-cols-7` -> flex rows (grid is unverified on the Lynx web target; flex is the
// shipped path). Elements: <div>/<button> -> <view bindtap>, <span> -> <text> (explicit
// colour + size on every <text>; <text> does not inherit).
import { ChevronLeft, ChevronRight, ChevronUp } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { pad2 } from "@/lib/date";
import { localDate, useMonthOpenCounts } from "../api";
import { addDays, toLocalNoon } from "../dates";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** The month grid. Tap a day and the page below flips to it. */
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
  const rows = Array.from({ length: weeks }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const shiftMonth = (delta: number) => {
    const d = new Date(firstNoon);
    d.setMonth(d.getMonth() + delta);
    onMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  };

  return (
    <view data-testid="month-view">
      <view className="flex items-center justify-between px-1">
        <text className="font-display text-sm font-bold tracking-tight text-ink">
          {firstNoon.toLocaleDateString("en", { month: "long" })}{" "}
          <text className="font-display text-sm font-bold tracking-tight text-ink-muted">
            {firstNoon.getFullYear()}
          </text>
        </text>
        <view className="flex items-center gap-1">
          <HeaderButton label="Previous month" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4 text-ink-muted" />
          </HeaderButton>
          <HeaderButton label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4 text-ink-muted" />
          </HeaderButton>
          <HeaderButton label="Fold back to the week" onClick={onToggleView}>
            <ChevronUp className="h-4 w-4 text-ink-muted" />
          </HeaderButton>
        </view>
      </view>

      <view className="mt-2 flex gap-0.5 px-1.5">
        {WEEKDAYS.map((w, i) => (
          <text
            key={i}
            className="flex-1 pb-1 text-center text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted"
          >
            {w}
          </text>
        ))}
      </view>
      <view className="inset-well flex flex-col gap-0.5 rounded-2xl bg-ink/[0.04] p-1">
        {rows.map((row, ri) => (
          <view key={ri} className="flex gap-0.5">
            {row.map((d) => {
              const inMonth = d.startsWith(month);
              const isSelected = d === selected;
              const isToday = d === today;
              const taskDots = Math.min(counts[d] ?? 0, 3);
              const sessions = (sessionDots[d] ?? []).slice(0, 2);
              return (
                <view
                  key={d}
                  bindtap={() => onSelect(d)}
                  accessibility-label={toLocalNoon(d).toLocaleDateString("en", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  accessibility-traits="button"
                  accessibility-value={isSelected ? "selected" : undefined}
                  data-testid="month-cell"
                  data-day={d}
                  className="relative flex h-11 flex-1 flex-col items-center justify-center rounded-xl active:scale-95"
                >
                  {isSelected && (
                    <view className="grain absolute inset-0 rounded-xl border border-rule/70 bg-surface shadow-soft" />
                  )}
                  <text
                    className={cn(
                      "relative font-display text-[15px] font-bold leading-none tracking-tight",
                      isToday ? "text-zest" : inMonth ? "text-ink" : "text-ink-muted/40",
                    )}
                  >
                    {Number(d.slice(8))}
                  </text>
                  <view className="relative mt-1 flex h-1 items-center gap-0.5">
                    {Array.from({ length: taskDots }).map((_, i) => (
                      <view
                        key={`t${i}`}
                        data-testid="month-task-dot"
                        className="h-1 w-1 rounded-full bg-zest/80"
                      />
                    ))}
                    {sessions.map((accent, i) => (
                      <view key={`s${i}`} className={cn("h-1 w-1 rounded-full", accent)} />
                    ))}
                  </view>
                </view>
              );
            })}
          </view>
        ))}
      </view>
    </view>
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
    <view
      bindtap={onClick}
      accessibility-label={label}
      accessibility-traits="button"
      className="flex h-7 w-7 items-center justify-center rounded-lg active:scale-90"
    >
      {children}
    </view>
  );
}
