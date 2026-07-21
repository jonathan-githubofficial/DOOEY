// Click-to-edit text (unit 4.2, ported from src-legacy/components/editable.tsx onto Lynx).
// Renders as plain text until tapped, then swaps to a Lynx <input>; Enter or blur commits, empty
// commits fall back to the original.
//
// Element mapping (crib "Elements, not HTML"): the old <button> display becomes a <view bindtap>
// wrapping a <text> (Lynx has no <button>; <text> does not inherit CSS, so colour/size stay on
// the node via className). The controlled <input> becomes a Lynx <input>, which has NO value prop
// (verified: @lynx-js/types input.d.ts) - so on entering edit mode we imperatively fill it with
// `setInputValue` and `focusInput` via SelectorQuery (the uncontrolled-input seam, lynxInput.ts).
// Events: `bindinput` -> draft (event.detail.value), `bindconfirm` (Enter) -> commit,
// `bindblur` -> commit. Escape-to-revert is dropped: Lynx mobile has no key event for it and there
// is no cross-platform select-all, so we keep focus-only + blur/enter commit (recorded PARKED).
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { focusInput, setInputValue, useDomId } from "@/lib/lynxInput";

export function EditableText({
  value,
  onCommit,
  className,
  inputClassName,
  placeholder,
  maxLength,
  ariaLabel,
  testId,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  maxLength?: number;
  ariaLabel: string;
  testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const draftRef = useRef(value);
  const id = useDomId("edit");

  // On entering edit mode, fill the (value-less) Lynx input with the current text and focus it.
  useEffect(() => {
    if (!editing) return;
    draftRef.current = value;
    setInputValue(id, value);
    focusInput(id);
    // `value` is intentionally read at edit-open only; re-filling on every change would fight typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    const next = draftRef.current.trim();
    if (next && next !== value) onCommit(next);
    setEditing(false);
  };

  if (!editing) {
    return (
      <view
        bindtap={() => {
          draftRef.current = value;
          setEditing(true);
        }}
        accessibility-label={`Edit ${ariaLabel}`}
        data-testid={testId}
        className={cn(
          "-mx-1 rounded px-1 active:bg-ink/[0.06]",
          !value && "text-ink-muted/60",
          className,
        )}
      >
        <text className={cn("text-ink", !value && "text-ink-muted/60", className)}>
          {value || placeholder}
        </text>
      </view>
    );
  }

  return (
    <input
      id={id}
      maxlength={maxLength}
      placeholder={placeholder}
      accessibility-label={ariaLabel}
      data-testid={testId}
      bindinput={(e: { detail: { value: string } }) => {
        draftRef.current = e.detail.value;
      }}
      bindconfirm={commit}
      bindblur={commit}
      className={cn(
        "-mx-1 w-full rounded bg-ink/[0.06] px-1 text-ink",
        className,
        inputClassName,
      )}
    />
  );
}
