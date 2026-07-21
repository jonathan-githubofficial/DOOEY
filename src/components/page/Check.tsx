// The tactile checkbox (unit 4.2, ported from src-legacy/components/page/Check.tsx onto Lynx).
// Presses in on tap, and the tick springs on when `done` flips true. `gate` marks a learning gate
// - the ring turns zest until it is cleared. The `done`/`gate`/`onToggle`/`label`/`className` API
// is kept IDENTICAL: unit 4.3's sheets and this unit's page sections all depend on it.
//
// Motion: this is the shared completion micro-interaction that 4.3 (PLAN 5.3) owns. It ships here
// with the story's sanctioned uiVariants/CSS form (BROOM: "MTS press (SPEC 5) OR a CSS
// `:active`-equivalent via uiVariants") - the SAME `active:scale-*` press the L2 StampButton/Slider
// already use on the web target - and a CSS-transition tick draw-on with a cubic-bezier overshoot,
// gated on reduced-motion. The two-line MTS `main-thread:bindtap` setStyleProperty variant SPEC 5
// describes is deferred to 4.3's shared press helper (SPEC 5 "4.3 reconciles"); no committed code
// wires MTS yet, and `main-thread:bind*` is not in the pinned @lynx-js/react JSX types, so the
// low-risk sanctioned path is used here.
//
// Element mapping: the old <motion.button> becomes a <view bindtap> (Lynx has no <button>); the
// tick is the L2 <Check> icon inside a <view> whose scale transitions on `done`. `aria-pressed`
// -> `accessibility-value`; `aria-label` -> `accessibility-label`.
import { Check as CheckIcon } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/stores";

export function Check({
  done,
  gate,
  onToggle,
  label,
  className,
}: {
  done: boolean;
  gate?: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <view
      bindtap={() => onToggle()}
      accessibility-label={label}
      accessibility-traits="button"
      accessibility-value={done ? "checked" : "unchecked"}
      data-testid="check"
      data-done={done ? "true" : "false"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors active:scale-[0.82]",
        done
          ? "border-leaf bg-leaf text-paper"
          : gate
            ? "border-zest text-transparent"
            : "border-rule text-transparent",
        className,
      )}
    >
      <view
        className={cn(
          "flex items-center justify-center",
          done ? "scale-100" : "scale-0",
          !reduced && "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.5,1)]",
        )}
      >
        <CheckIcon className="h-3.5 w-3.5 text-paper" />
      </view>
    </view>
  );
}
