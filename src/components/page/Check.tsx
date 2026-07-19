import { motion } from "motion/react";
import { Check as CheckIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** The tactile checkbox: presses in on tap, the tick springs on when done.
 * `gate` marks a learning gate — the ring turns zest until it's cleared. */
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
  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={done}
      aria-label={label}
      whileTap={{ scale: 0.78 }}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        done
          ? "border-leaf bg-leaf text-paper"
          : gate
            ? "border-zest text-transparent hover:bg-zest/10"
            : "border-rule text-transparent hover:border-ink",
        className,
      )}
    >
      <motion.span
        initial={false}
        animate={{ scale: done ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 18 }}
      >
        <CheckIcon className="h-3.5 w-3.5" strokeWidth={3} />
      </motion.span>
    </motion.button>
  );
}
