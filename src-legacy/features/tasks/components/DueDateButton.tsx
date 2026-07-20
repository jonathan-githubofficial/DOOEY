import { useRef } from "react";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { dateOnly, dueInfo, toPbDate } from "../dates";

/** The due-date chip: tap to open the native date picker, x to clear. */
export function DueDateButton({
  due,
  onChange,
}: {
  due: string;
  onChange: (due: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const info = due ? dueInfo(due) : null;

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.showPicker()}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-[color,border-color,transform] active:scale-95",
          !info && "border-rule text-ink-muted hover:border-ink hover:text-ink",
          info?.tone === "overdue" && "border-clay/40 bg-clay/10 text-clay",
          info?.tone === "today" && "border-zest/40 bg-zest/10 text-zest",
          info?.tone === "future" && "border-rule bg-paper text-ink",
        )}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {info ? `due ${info.text}` : "due date"}
      </button>
      {due && (
        <button
          type="button"
          aria-label="Clear due date"
          onClick={() => onChange("")}
          className="ml-1.5 rounded-full p-0.5 text-ink-muted/60 transition-colors hover:text-clay"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={due ? dateOnly(due) : ""}
        onChange={(e) => onChange(e.target.value ? toPbDate(e.target.value) : "")}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
      />
    </span>
  );
}
