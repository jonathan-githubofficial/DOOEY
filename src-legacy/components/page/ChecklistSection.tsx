import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel } from "@/components/surface";
import { EditableText } from "@/components/editable";
import type { ChecklistItem } from "./types";
import { Check } from "./Check";

export function ChecklistSection({
  items,
  onChange,
  autoFocus,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  autoFocus?: boolean;
}) {
  const [label, setLabel] = useState("");
  const doneCount = items.filter((i) => i.done).length;

  return (
    <Panel className="p-5 md:p-6">
      <div className="flex items-baseline justify-between">
        <Eyebrow>checklist</Eyebrow>
        {items.length > 0 && (
          <span className={cn("text-xs", doneCount === items.length ? "text-leaf" : "text-ink-muted")}>
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              className="group flex items-center gap-2.5"
            >
              <Check
                done={item.done}
                className="h-5 w-5"
                label={item.done ? `Uncheck "${item.label}"` : `Check "${item.label}"`}
                onToggle={() =>
                  onChange(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
                }
              />
              <EditableText
                value={item.label}
                ariaLabel={`checklist item "${item.label}"`}
                onCommit={(next) =>
                  onChange(items.map((i) => (i.id === item.id ? { ...i, label: next } : i)))
                }
                className={cn(
                  "min-w-0 flex-1 text-[15px]",
                  item.done && "text-ink-muted line-through decoration-rule",
                )}
              />
              <button
                type="button"
                aria-label={`Remove "${item.label}"`}
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                className="text-ink-muted/50 opacity-0 transition-[opacity,color] hover:text-clay focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const l = label.trim();
          if (!l) return;
          onChange([...items, { id: crypto.randomUUID(), label: l, done: false }]);
          setLabel("");
        }}
        className={cn("flex items-center gap-2.5 text-ink-muted", items.length > 0 && "mt-3")}
      >
        <Plus className="h-4 w-4 shrink-0" />
        <input
          value={label}
          autoFocus={autoFocus}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add an item…"
          aria-label="Add a checklist item"
          enterKeyHint="done"
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/60"
        />
      </form>
    </Panel>
  );
}
