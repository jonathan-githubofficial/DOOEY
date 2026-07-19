import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { ArrowUpRight, Clock, StickyNote, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { localDate, useCreateTask } from "../api";
import { toLocalNoon, toPbDate } from "../dates";
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

const pad = (n: number) => String(n).padStart(2, "0");
const minToTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const timeToMin = (str: string) => {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
};

/** The task drawer: slides up from the bottom edge with everything you need to
 * shape a task — title, details, date, an optional time slot with duration,
 * notes. Deeper structure (checklist, resources, attachments) lives on the
 * task's page via "Add & open". Flick the handle down to dismiss.
 *
 * Mount it inside <AnimatePresence> and unmount to close (the exit animation
 * runs on unmount). `initialStart` opens it pre-scheduled at that minute. */
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
  const controls = useDragControls();
  const isToday = date === localDate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  // The viewed day is the default due date; plain "today" needs none.
  const [due, setDue] = useState(initialStart != null || !isToday ? toPbDate(date) : "");
  const [start, setStart] = useState<number | null>(initialStart ?? null);
  const [dur, setDur] = useState(initialDur ?? 60);

  const dayLabel = toLocalNoon(date).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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
    if (!title.trim()) return;
    create.mutate(payload());
    onClose();
  };
  const submitAndOpen = async () => {
    if (!title.trim()) return;
    const record = await create.mutateAsync(payload());
    onClose();
    void navigate({ to: "/task/$id", params: { id: record.id } });
  };

  const toggleTime = () =>
    setStart((s) => {
      if (s != null) return null;
      setDue(toPbDate(date));
      return 9 * 60;
    });

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink/25"
      />
      <motion.div
        role="dialog"
        aria-label="New task"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 36 }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        dragSnapToOrigin
        onDragEnd={(_e, info) => {
          if (info.offset.y > 80 || info.velocity.y > 500) onClose();
        }}
        className="grain fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl rounded-t-3xl border border-b-0 border-rule/70 bg-surface px-5 pb-8 pt-3 shadow-soft"
      >
        <div
          onPointerDown={(e) => controls.start(e)}
          style={{ touchAction: "none" }}
          className="-mx-5 flex cursor-grab justify-center pb-3 pt-1 active:cursor-grabbing"
          aria-hidden
        >
          <span className="h-1 w-10 rounded-full bg-ink/15" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            new task{start != null ? ` · ${dayLabel}` : ""}
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="Task title"
            enterKeyHint="done"
            className="mt-2 w-full bg-transparent font-display text-xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-muted/50"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            aria-label="Task details"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="mt-2 w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/50"
          />

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {start == null && <DueDateButton due={due} onChange={setDue} />}
            <button
              type="button"
              onClick={toggleTime}
              aria-pressed={start != null}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-[color,border-color,transform] active:scale-95",
                start != null
                  ? "border-zest/50 bg-zest/10 text-zest"
                  : "border-rule text-ink-muted hover:border-ink hover:text-ink",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {start != null ? "timed" : "add time"}
            </button>
            <button
              type="button"
              onClick={() => setShowNotes((s) => !s)}
              aria-pressed={showNotes}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-[color,border-color,transform] active:scale-95",
                showNotes
                  ? "border-honey/50 bg-honey/10 text-ink"
                  : "border-rule text-ink-muted hover:border-ink hover:text-ink",
              )}
            >
              <StickyNote className="h-3.5 w-3.5" />
              notes
            </button>
          </div>

          <AnimatePresence initial={false}>
            {start != null && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rule/60 bg-paper/50 p-2.5">
                  <input
                    type="time"
                    value={minToTime(start)}
                    onChange={(e) => e.target.value && setStart(timeToMin(e.target.value))}
                    aria-label="Start time"
                    className="rounded-lg border border-rule/60 bg-surface px-2 py-1 text-sm text-ink outline-none [color-scheme:light] dark:[color-scheme:dark]"
                  />
                  <span className="text-xs text-ink-muted">for</span>
                  <span className="flex flex-wrap gap-1">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.min}
                        type="button"
                        onClick={() => setDur(d.min)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                          dur === d.min
                            ? "bg-zest text-paper"
                            : "text-ink-muted hover:bg-ink/5 hover:text-ink",
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStart(null)}
                    aria-label="Remove time"
                    className="ml-auto rounded-full p-1 text-ink-muted/60 transition-colors hover:text-clay"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showNotes && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes for the task's page…"
                  aria-label="Task notes"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-rule/60 bg-paper/60 p-3 text-sm text-ink outline-none placeholder:text-ink-muted/50"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3.5 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <span className="flex items-center gap-1.5">
              <motion.button
                type="button"
                onClick={() => void submitAndOpen()}
                disabled={!title.trim() || create.isPending}
                whileTap={{ scale: 0.94 }}
                title="Add, then open the page for checklist, resources & attachments"
                className="flex items-center gap-1 rounded-full border border-rule bg-transparent px-4 py-2 text-xs font-medium text-ink transition-opacity hover:bg-ink/5 disabled:opacity-40"
              >
                Add &amp; open
                <ArrowUpRight className="h-3 w-3" />
              </motion.button>
              <motion.button
                type="submit"
                disabled={!title.trim() || create.isPending}
                whileTap={{ scale: 0.94 }}
                className="rounded-full bg-zest px-5 py-2 text-xs font-semibold text-paper shadow-soft transition-opacity disabled:opacity-40"
              >
                Add task
              </motion.button>
            </span>
          </div>
        </form>
      </motion.div>
    </>
  );
}
