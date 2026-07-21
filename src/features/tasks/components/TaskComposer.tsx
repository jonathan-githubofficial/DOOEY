// The new-task button (unit 4.1, ported from src-legacy/features/tasks/components/TaskComposer.tsx
// onto Lynx): a postage stamp pinned above the dock - a fresh slip waiting to be stuck onto the
// day. Tapping it mounts the ComposerSheet (4.3), which slides the task drawer up from the bottom
// edge. Used where there is no time grid to tap (the planner).
//
// DROPPED (recorded BROOM): `motion.button` with whileHover/whileTap/spring -> a main-thread press
// micro-interaction (SPEC 5): the shared MTS press helper (src/lib/motion/press.ts, owned by 4.3)
// depresses the stamp on the MAIN thread on touch (scale 0.9 via `data-press-scale`) and releases
// on touch-end/cancel, while the element's background-thread `bindtap` still opens the sheet. Note
// the resting `rotate:-4` + hover spring are dropped: SPEC 5 scopes the press to scale-only, and
// a static rotation would fight the worklet's transform. `AnimatePresence` around ComposerSheet ->
// a plain conditional mount; the slide-in/out is ComposerSheet's own CSS transition (4.3).
// `lucide-react` Plus -> the L2 icon set Plus (2.4). `<button>` -> `<view bindtap>` (crib).
import { useState } from "react";

import { Plus } from "@/components/icons/lucide";
import { pressDown, pressUp } from "@/lib/motion/press";
import { localDate } from "../api";
import { toLocalNoon } from "../dates";
import { ComposerSheet } from "./ComposerSheet";

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
      <view
        bindtap={() => setOpen(true)}
        user-interaction-enabled={true}
        main-thread:bindtouchstart={pressDown}
        main-thread:bindtouchend={pressUp}
        main-thread:bindtouchcancel={pressUp}
        data-press-scale="0.9"
        accessibility-label={isToday ? "New task" : `New task for ${dayLabel}`}
        accessibility-traits="button"
        data-testid="quick-add"
        className="stamp-edge stamp-btn grain fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center bg-zest text-paper active:scale-90 md:bottom-24 md:right-8"
      >
        <Plus className="h-6 w-6 text-paper" />
      </view>

      {open && <ComposerSheet date={date} onClose={() => setOpen(false)} />}
    </>
  );
}
