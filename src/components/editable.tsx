import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Click-to-edit text. Renders as plain text until clicked, then becomes an input.
 * Enter or blur commits; Escape reverts. Empty commits fall back to the original.
 */
export function EditableText({
  value,
  onCommit,
  className,
  inputClassName,
  placeholder,
  maxLength,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  maxLength?: number;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={`Edit ${ariaLabel}`}
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "-mx-1 rounded px-1 text-left transition-colors hover:bg-ink/[0.06]",
          !value && "text-ink-muted/60",
          className,
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <input
      ref={ref}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn(
        "-mx-1 w-full rounded bg-ink/[0.06] px-1 outline-none ring-1 ring-ink/20",
        className,
        inputClassName,
      )}
    />
  );
}
