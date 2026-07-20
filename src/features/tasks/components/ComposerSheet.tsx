// The task composer drawer (unit 4.3, ported from src-legacy/features/tasks/components/
// ComposerSheet.tsx onto Lynx): the sheet that slides up from the bottom edge to shape a new task
// - title, details, due date, an optional time slot with duration, notes - with Cancel /
// "Add & open" / "Add task".
//
// SHEET MOTION (SPEC 3): NO framer-motion / AnimatePresence. The parent (TaskComposer, 4.1) mounts
// this on open; on close it plays an exit animation then calls onClose. Backdrop cross-fades; the
// sheet slides translateY(100%->0) in (SETTLE) and 0->100% out (PEEL); reduced-motion swaps the
// translate for an opacity fade. Removal is driven by bindanimationend on the out-animation, with a
// duration-matched timeout as a web-target fallback (guarded so onClose fires once).
//
// DROPPED (recorded BROOM): `motion`/`AnimatePresence` (backdrop, sheet, the time/notes height
// sections) -> the CSS keyframes in styles/global.css + max-height/opacity transitions here;
// `useDragControls` + all drag-to-dismiss props (drag="y"/dragControls/dragConstraints/
// dragElastic/dragSnapToOrigin/onDragEnd) -> unit 5.2 (this unit closes via backdrop tap, the
// Cancel control, and the header handle as a plain TAP); `lucide-react` -> the L2 icon set;
// `<form onSubmit>`/`<button>` -> Lynx `<view bindtap>`; the DOM `<input>`/`<textarea>` -> Lynx
// `<input>`/`<textarea>` (event-driven, NO `value` prop - bindinput reports text, bindconfirm =
// Enter-to-submit on the title; the description's Enter-without-shift submit drops - no keydown on
// Lynx targets, so submit rides the explicit buttons). ADAPT: the native `<input type="time">` has
// no Lynx equivalent (input types are text/number/digit/password/tel/email) -> a compact
// -1h/-15/+15/+1h stepper writing `start` minutes (the sanctioned SPEC alternative; matches the L2
// Slider stepper, and sidesteps the uncontrolled-input pre-fill dance for a value the sheet owns).
// The HH:MM-string helper `minToTime` is kept for the readout; `timeToMin` is moot with a stepper
// and dropped. Press feel on "Add task" uses the shared MTS press helper (src/lib/motion/press.ts).
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { ArrowUpRight, Clock, StickyNote, X } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { pad2 } from "@/lib/date";
import { PEEL, SETTLE } from "@/lib/motion/easing";
import { pressDown, pressUp } from "@/lib/motion/press";
import { useReducedMotion } from "@/stores";
import { localDate, useCreateTask } from "../api";
import { toLocalNoon, toPbDate } from "../dates";
import { clamp } from "../timeGrid";
import { DueDateButton } from "./DueDateButton";

const DURATIONS = [
  { min: 15, label: "15m" },
  { min: 30, label: "30m" },
  { min: 45, label: "45m" },
  { min: 60, label: "1h" },
  { min: 90, label: "1h 30" },
  { min: 120, label: "2h" },
  { min: 180, label: "3h" },
];

const DEFAULT_START = 9 * 60;
const MAX_START = 23 * 60 + 45;
/** minutes-from-midnight -> "HH:MM" readout label. */
const minToTime = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

export function ComposerSheet({
  date,
  initialStart,
  initialDur,
  onClose,
}: {
  date: string;
  initialStart?: number;
  initialDur?: number;
  onClose: () => void;
}) {
  const create = useCreateTask();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const isToday = date === localDate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  // The viewed day is the default due date; plain "today" needs none.
  const [due, setDue] = useState(initialStart != null || !isToday ? toPbDate(date) : "");
  const [start, setStart] = useState<number | null>(initialStart ?? null);
  const [dur, setDur] = useState(initialDur ?? 60);
  const [exiting, setExiting] = useState(false);

  const dayLabel = toLocalNoon(date).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Close once: the exit animation's bindanimationend OR the duration-matched fallback fires this.
  const closedRef = useRef(false);
  const finish = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  };
  const close = () => {
    setExiting(true);
    setTimeout(finish, 420);
  };

  const canSubmit = !!title.trim() && !create.isPending;
  const payload = () => ({
    title: title.trim(),
    description: description.trim() || undefined,
    notes: notes.trim() || undefined,
    // A timed task must belong to a day, so pin the due date when scheduled.
    due_date: start != null ? toPbDate(date) : due || undefined,
    start_min: start ?? 0,
    dur_min: dur,
  });
  const submit = () => {
    if (!canSubmit) return;
    create.mutate(payload());
    close();
  };
  const submitAndOpen = async () => {
    if (!canSubmit) return;
    const record = await create.mutateAsync(payload());
    void navigate({ to: "/task/$id", params: { id: record.id } });
    close();
  };

  const toggleTime = () =>
    setStart((s) => {
      if (s != null) return null;
      setDue(toPbDate(date));
      return DEFAULT_START;
    });
  const bump = (d: number) => setStart((s) => clamp((s ?? DEFAULT_START) + d, 0, MAX_START));

  const backdropAnim = exiting
    ? "dooey-fade-out 180ms linear both"
    : "dooey-fade-in 180ms linear both";
  const sheetAnim = reduced
    ? exiting
      ? "dooey-fade-out 180ms linear both"
      : "dooey-fade-in 180ms linear both"
    : exiting
      ? `dooey-sheet-out 300ms ${PEEL} both`
      : `dooey-sheet-in 320ms ${SETTLE} both`;

  const timeOpen = start != null;

  // Plain render helper (NOT a component - avoids remount-on-render): a start-time nudge button.
  const stepBtn = (label: string, delta: number) => (
    <view
      key={label}
      bindtap={() => bump(delta)}
      accessibility-label={`Shift start ${label}`}
      accessibility-traits="button"
      className="flex h-7 items-center justify-center rounded-full border border-rule bg-surface px-2 active:scale-90"
    >
      <text className="text-[11px] font-medium tabular-nums text-ink">{label}</text>
    </view>
  );

  return (
    <view>
      <view
        bindtap={close}
        accessibility-label="Close"
        accessibility-traits="button"
        data-testid="composer-backdrop"
        className="fixed inset-0 z-50 bg-ink/25"
        style={{ animation: backdropAnim }}
      />
      <view
        accessibility-label="New task"
        data-testid="composer-sheet"
        bindanimationend={() => {
          if (exiting) finish();
        }}
        className="grain fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl rounded-t-3xl border border-b-0 border-rule/70 bg-surface px-5 pb-8 pt-3 shadow-soft"
        style={{ animation: sheetAnim }}
      >
        {/* Grab handle - a plain TAP-to-close bar (drag-to-dismiss = 5.2). */}
        <view
          bindtap={close}
          accessibility-label="Close"
          data-testid="composer-handle"
          className="-mx-5 flex justify-center pb-3 pt-1 active:scale-95"
        >
          <view className="h-1 w-10 rounded-full bg-ink/15" />
        </view>

        <text className="block text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          {timeOpen ? `new task · ${dayLabel}` : "new task"}
        </text>

        <input
          bindinput={(e: { detail: { value: string } }) => setTitle(e.detail.value)}
          bindconfirm={submit}
          placeholder="What needs doing?"
          accessibility-label="Task title"
          data-testid="composer-title"
          className="mt-2 w-full bg-transparent font-display text-xl font-bold tracking-tight text-ink placeholder:text-ink-muted/50"
        />
        <textarea
          bindinput={(e: { detail: { value: string } }) => setDescription(e.detail.value)}
          placeholder="Details (optional)"
          accessibility-label="Task details"
          className="mt-2 h-12 w-full bg-transparent text-sm text-ink placeholder:text-ink-muted/50"
        />

        <view className="mt-1 flex flex-wrap items-center gap-2">
          {!timeOpen && <DueDateButton due={due} onChange={setDue} />}
          <view
            bindtap={toggleTime}
            accessibility-label={timeOpen ? "Remove time" : "Add time"}
            accessibility-traits="button"
            accessibility-value={timeOpen ? "on" : "off"}
            data-testid="composer-add-time"
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 active:scale-95",
              timeOpen ? "border-zest/50 bg-zest/10" : "border-rule",
            )}
          >
            <Clock className="h-3.5 w-3.5 text-ink-muted" />
            <text className={cn("text-xs font-medium", timeOpen ? "text-zest" : "text-ink-muted")}>
              {timeOpen ? "timed" : "add time"}
            </text>
          </view>
          <view
            bindtap={() => setShowNotes((s) => !s)}
            accessibility-label="Notes"
            accessibility-traits="button"
            accessibility-value={showNotes ? "on" : "off"}
            data-testid="composer-notes-toggle"
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 active:scale-95",
              showNotes ? "border-honey/50 bg-honey/10" : "border-rule",
            )}
          >
            <StickyNote className="h-3.5 w-3.5 text-ink-muted" />
            <text className={cn("text-xs font-medium", showNotes ? "text-ink" : "text-ink-muted")}>
              notes
            </text>
          </view>
        </view>

        {/* Time row: DROPPED AnimatePresence height section -> a max-height/opacity transition
            (crib: CSS transitions for enter/exit), gated on reduced-motion. */}
        <view
          className={cn(
            "overflow-hidden",
            !reduced && "transition-[max-height,opacity] duration-200 ease-out",
            timeOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <view className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rule/60 bg-paper/50 p-2.5">
            <view className="flex items-center gap-1">
              {stepBtn("-1h", -60)}
              {stepBtn("-15", -15)}
              <text
                data-testid="composer-time"
                className="w-12 text-center text-sm font-medium tabular-nums text-ink"
              >
                {minToTime(start ?? DEFAULT_START)}
              </text>
              {stepBtn("+15", 15)}
              {stepBtn("+1h", 60)}
            </view>
            <text className="text-xs text-ink-muted">for</text>
            <view className="flex flex-wrap gap-1">
              {DURATIONS.map((d) => (
                <view
                  key={d.min}
                  bindtap={() => setDur(d.min)}
                  accessibility-label={`${d.label} duration`}
                  accessibility-traits="button"
                  className={cn(
                    "rounded-full px-2.5 py-1 active:scale-95",
                    dur === d.min ? "bg-zest" : "bg-transparent",
                  )}
                >
                  <text
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      dur === d.min ? "text-paper" : "text-ink-muted",
                    )}
                  >
                    {d.label}
                  </text>
                </view>
              ))}
            </view>
            <view
              bindtap={() => setStart(null)}
              accessibility-label="Remove time"
              accessibility-traits="button"
              className="ml-auto rounded-full p-1 active:scale-90"
            >
              <X className="h-3.5 w-3.5 text-ink-muted" />
            </view>
          </view>
        </view>

        {/* Notes row: same dropped-AnimatePresence -> CSS transition. */}
        <view
          className={cn(
            "overflow-hidden",
            !reduced && "transition-[max-height,opacity] duration-200 ease-out",
            showNotes ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <textarea
            bindinput={(e: { detail: { value: string } }) => setNotes(e.detail.value)}
            placeholder="Notes for the task's page…"
            accessibility-label="Task notes"
            className="mt-2 h-16 w-full rounded-xl border border-rule/60 bg-paper/60 p-3 text-sm text-ink placeholder:text-ink-muted/50"
          />
        </view>

        <view className="mt-3 flex items-center justify-between gap-1.5">
          <view
            bindtap={close}
            accessibility-label="Cancel"
            accessibility-traits="button"
            data-testid="composer-cancel"
            className="rounded-full px-3.5 py-2 active:scale-95"
          >
            <text className="text-xs font-medium text-ink-muted">Cancel</text>
          </view>
          <view className="flex items-center gap-1.5">
            <view
              bindtap={canSubmit ? () => void submitAndOpen() : undefined}
              user-interaction-enabled={canSubmit}
              accessibility-label="Add and open the task page"
              accessibility-traits="button"
              data-testid="composer-submit-open"
              className={cn(
                "flex items-center gap-1 rounded-full border border-rule bg-transparent px-4 py-2 active:scale-95",
                !canSubmit && "opacity-40",
              )}
            >
              <text className="text-xs font-medium text-ink">Add &amp; open</text>
              <ArrowUpRight className="h-3 w-3 text-ink" />
            </view>
            <view
              bindtap={canSubmit ? submit : undefined}
              user-interaction-enabled={canSubmit}
              main-thread:bindtouchstart={pressDown}
              main-thread:bindtouchend={pressUp}
              main-thread:bindtouchcancel={pressUp}
              accessibility-label="Add task"
              accessibility-traits="button"
              data-testid="composer-submit"
              className={cn(
                "rounded-full bg-zest px-5 py-2 shadow-soft active:scale-95",
                !canSubmit && "opacity-40",
              )}
            >
              <text className="text-xs font-semibold text-paper">Add task</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  );
}
