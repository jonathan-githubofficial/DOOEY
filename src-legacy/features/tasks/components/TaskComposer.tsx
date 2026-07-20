import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { localDate } from "../api";
import { toLocalNoon } from "../dates";
import { ComposerSheet } from "./ComposerSheet";

/** The new-task button: a postage stamp pinned above the dock — a fresh slip
 * waiting to be stuck onto the day. Tapping it slides the task drawer up from
 * the bottom edge. Used where there's no time grid to tap (the planner). */
export function TaskComposer({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const isToday = date === localDate();
  const dayLabel = toLocalNoon(date).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ rotate: -4 }}
        whileHover={{ rotate: 0, scale: 1.06 }}
        whileTap={{ scale: 0.9, rotate: -2 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        aria-label={isToday ? "New task" : `New task for ${dayLabel}`}
        title="New task"
        className="stamp-edge stamp-btn grain fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center bg-zest text-paper md:bottom-24 md:right-8"
      >
        <Plus className="h-6 w-6" strokeWidth={2.6} />
      </motion.button>

      <AnimatePresence>
        {open && <ComposerSheet date={date} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
