// Due-date chip — MINIMAL forward-dependency stub (unit 4.2).
//
// The full interactive chip (tap to open a date picker, x to clear) is OWNED BY UNIT 4.3
// (this unit's OUT OF BOUNDS list). But the L4 land order is 4.2 -> 4.3 -> 4.1 (ruling R4), so
// 4.2 lands FIRST and TaskDetail must compile against a real `./DueDateButton`. This stub renders
// the due date READ-ONLY (real data via `dueInfo`, tone-coloured), which is honest - not a "coming
// soon" placeholder - and keeps the exact `{ due, onChange }` prop surface TaskDetail calls. Unit
// 4.3 REPLACES this file with the interactive picker (porting src-legacy DueDateButton.tsx +
// broomstick), wiring `onChange`; until then editing the due date is deferred (recorded).
import { CalendarDays } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { dueInfo } from "../dates";

export function DueDateButton({
  due,
}: {
  due: string;
  /** Wired by unit 4.3's interactive replacement; unused in this read-only stub. */
  onChange: (due: string) => void;
}) {
  const info = due ? dueInfo(due) : null;
  return (
    <view
      accessibility-label={info ? `Due ${info.text}` : "No due date"}
      data-testid="task-due"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        !info && "border-rule",
        info?.tone === "overdue" && "border-clay/40 bg-clay/10",
        info?.tone === "today" && "border-zest/40 bg-zest/10",
        info?.tone === "future" && "border-rule bg-paper",
      )}
    >
      <CalendarDays className="h-3.5 w-3.5 text-ink-muted" />
      <text
        className={cn(
          "text-xs font-medium",
          !info && "text-ink-muted",
          info?.tone === "overdue" && "text-clay",
          info?.tone === "today" && "text-zest",
          info?.tone === "future" && "text-ink",
        )}
      >
        {info ? `due ${info.text}` : "due date"}
      </text>
    </view>
  );
}
