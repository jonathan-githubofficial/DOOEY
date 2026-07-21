// The due-date chip (unit 4.3, ported from src-legacy/features/tasks/components/DueDateButton.tsx
// onto Lynx). REPLACES the read-only forward-dependency stub unit 4.2 shipped (R4 land order):
// TaskDetail (4.2) and ComposerSheet (this unit) both drive it through the SAME `{ due, onChange }`
// prop surface, unchanged.
//
// DROPPED from the DOM original (recorded BROOM): the hidden `<input type="date">` +
// `inputRef.current.showPicker()` (Lynx has no `type="date"` and no showPicker - input types are
// text/number/digit/password/tel/email per https://lynxjs.org/api/elements/built-in/input.html);
// `lucide-react` -> the L2 icon set; the `<button>`/`<span>` -> `<view bindtap>`/`<text>` (no
// <button>; <text> does not inherit CSS, so colour/size stay on each node). REPLACED with a small
// pop-open quick-chip panel (SPEC 5): Today / Tomorrow / +2d / +3d / +7d / Clear, built from the
// pure `dates.ts` helpers. Selecting a chip calls onChange and closes.
//
// BROOM: full calendar-grid date picking -> unit 5.1 (reuse `MonthView`).
import { useState } from "react";

import { CalendarDays, X } from "@/components/icons/lucide";
import { Panel } from "@/components/surface";
import { cn } from "@/lib/cn";
import { addDays, dueInfo, localDate, toPbDate } from "../dates";

/** The quick-pick options, computed from "today" at render (they track the current day). */
function quickOptions(): { key: string; label: string; value: string }[] {
  const today = localDate();
  return [
    { key: "today", label: "Today", value: toPbDate(today) },
    { key: "tomorrow", label: "Tomorrow", value: toPbDate(addDays(today, 1)) },
    { key: "2", label: "+2 days", value: toPbDate(addDays(today, 2)) },
    { key: "3", label: "+3 days", value: toPbDate(addDays(today, 3)) },
    { key: "7", label: "+1 week", value: toPbDate(addDays(today, 7)) },
  ];
}

export function DueDateButton({
  due,
  onChange,
}: {
  due: string;
  onChange: (due: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const info = due ? dueInfo(due) : null;

  const pick = (value: string) => {
    onChange(value);
    setOpen(false);
  };

  return (
    <view className="relative inline-flex">
      <view
        bindtap={() => setOpen((o) => !o)}
        accessibility-label={info ? `Due ${info.text}. Change due date` : "Set due date"}
        accessibility-traits="button"
        data-testid="task-due"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 active:scale-95",
          !info && "border-rule bg-paper",
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

      {open && (
        <Panel
          data-testid="due-popover"
          className="absolute left-0 top-[calc(100%+6px)] z-50 w-40 p-2"
        >
          {quickOptions().map((opt) => (
            <view
              key={opt.key}
              bindtap={() => pick(opt.value)}
              accessibility-label={`Due ${opt.label}`}
              accessibility-traits="button"
              data-testid={`due-quick-${opt.key}`}
              className="flex items-center rounded-lg px-2.5 py-1.5 active:bg-ink/[0.06]"
            >
              <text className="text-sm text-ink">{opt.label}</text>
            </view>
          ))}
          <view
            bindtap={() => pick("")}
            accessibility-label="Clear due date"
            accessibility-traits="button"
            data-testid="due-quick-clear"
            className="mt-1 flex items-center gap-1.5 rounded-lg border-t border-rule/50 px-2.5 pb-1 pt-2 active:bg-ink/[0.06]"
          >
            <X className="h-3 w-3 text-ink-muted" />
            <text className="text-sm text-ink-muted">Clear</text>
          </view>
        </Panel>
      )}
    </view>
  );
}
