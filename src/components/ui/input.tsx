// Ported from src-legacy/components/ui/input.tsx (unit 2.3). Lynx <input> has a real
// `disabled` boolean prop plus `bindinput`/`bindfocus`/`bindblur`. `focus-visible:ring-2 ...`
// becomes a plain `focused && "ring-2 ring-leaf"` class driven by bindfocus/bindblur state,
// since Lynx has no `:focus`/`:focus-visible` selector
// (https://lynxjs.org/api/css/selectors.html).
//
// No `value`/`defaultValue` prop (verified against https://lynxjs.org/api/elements/built-in/
// input - not in the documented attribute list): Lynx's <input> is event-driven + imperative
// only (bindinput reports the current value; getValue()/setValue() are SelectorQuery UI
// methods), unlike React DOM's controlled-input convention. `value` stays on this component's
// prop surface for future callers that want a controlled feel, but is intentionally NOT wired
// to the element yet - no consumer in this unit needs it (Gallery renders an uncontrolled
// instance) - and it would take a ref + setValue()/getValue() bridge to do properly. Flagged
// here rather than silently faked; a later unit that needs controlled `<Input value=.../>`
// must build that bridge.
import { useState } from "react";
import { cn } from "@/lib/cn";

interface InputProps {
  className?: string;
  type?: "text" | "number" | "digit" | "password" | "tel" | "email";
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  onInput?: (value: string) => void;
}

export function Input({ className, type, placeholder, disabled, onInput }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      bindinput={(e: { detail: { value: string } }) => onInput?.(e.detail.value)}
      bindfocus={() => setFocused(true)}
      bindblur={() => setFocused(false)}
      className={cn(
        "flex h-10 w-full rounded-md border border-rule bg-transparent px-3 py-2 text-base text-ink font-sans",
        focused && "ring-2 ring-leaf",
        disabled && "opacity-50",
        className,
      )}
    />
  );
}
