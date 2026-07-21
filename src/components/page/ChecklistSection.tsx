// A checklist section (unit 4.2, ported from src-legacy/components/page/ChecklistSection.tsx onto
// Lynx): list render, add-form, toggle, inline edit (via EditableText), remove.
//
// Element mapping: the <form onSubmit> add-field becomes a Lynx <input> whose `bindconfirm` (Enter)
// adds the item (Lynx has no <form>/onSubmit; the input's confirm event is the submit). The input
// is uncontrolled (no value prop): the draft is read from `bindinput`, and cleared after add via
// setInputValue. The framer <motion.li> list-item springs are dropped -> a CSS enter animation
// (.animate-enter) gated on reduced-motion; the `<motion.li>` becomes a <view>. Removal is
// immediate (AnimatePresence exit has no cheap Lynx equivalent without keeping the node mounted -
// recorded reduction). `lucide-react` Plus/X -> the L2 icon set. The `group-hover` remove-button
// reveal is dropped: touch has no hover (crib, no `:hover`), so remove is always visible.
// `crypto.randomUUID()` -> the shared `newId()` helper (SPEC 9).
import { useEffect, useRef } from "react";

import { Plus, X } from "@/components/icons/lucide";
import type { ChecklistItem } from "@/components/page/types";
import { Check } from "@/components/page/Check";
import { EditableText } from "@/components/editable";
import { Eyebrow, Panel } from "@/components/surface";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/id";
import { focusInput, setInputValue, useDomId } from "@/lib/lynxInput";
import { useReducedMotion } from "@/stores";

export function ChecklistSection({
  items,
  onChange,
  autoFocus,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  autoFocus?: boolean;
}) {
  const reduced = useReducedMotion();
  const id = useDomId("checklist-add");
  const draftRef = useRef("");
  const doneCount = items.filter((i) => i.done).length;

  // autoFocus (only when the section was just opened, empty): Lynx has no autoFocus attribute.
  useEffect(() => {
    if (autoFocus) focusInput(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = () => {
    const label = draftRef.current.trim();
    if (!label) return;
    onChange([...items, { id: newId(), label, done: false }]);
    draftRef.current = "";
    setInputValue(id, "");
    focusInput(id);
  };

  return (
    <Panel className="p-5 md:p-6">
      <view className="flex items-baseline justify-between">
        <Eyebrow>checklist</Eyebrow>
        {items.length > 0 && (
          <text
            data-testid="checklist-count"
            className={cn("text-xs", doneCount === items.length ? "text-leaf" : "text-ink-muted")}
          >
            {doneCount}/{items.length}
          </text>
        )}
      </view>

      <view className="mt-3 space-y-2">
        {items.map((item) => (
          <view
            key={item.id}
            data-testid="checklist-item"
            className={cn("flex items-center gap-2.5", !reduced && "animate-enter")}
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
                "min-w-0 flex-1 text-[15px] text-ink",
                item.done && "text-ink-muted line-through",
              )}
            />
            <view
              bindtap={() => onChange(items.filter((i) => i.id !== item.id))}
              accessibility-label={`Remove "${item.label}"`}
              className="text-ink-muted/50 active:scale-90"
            >
              <X className="h-3.5 w-3.5" />
            </view>
          </view>
        ))}
      </view>

      <view className={cn("flex items-center gap-2.5 text-ink-muted", items.length > 0 && "mt-3")}>
        <Plus className="h-4 w-4 shrink-0 text-ink-muted" />
        <input
          id={id}
          data-testid="checklist-add"
          placeholder="Add an item…"
          accessibility-label="Add a checklist item"
          confirm-type="done"
          bindinput={(e: { detail: { value: string } }) => {
            draftRef.current = e.detail.value;
          }}
          bindconfirm={add}
          bindblur={(e: { detail: { value: string } }) => {
            draftRef.current = e.detail.value;
          }}
          className="w-full bg-transparent text-[15px] text-ink"
        />
      </view>
    </Panel>
  );
}
