import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Masthead } from "@/components/masthead";
import { Panel, Eyebrow } from "@/components/surface";
import { cn } from "@/lib/cn";
import { PageDoodle } from "@/features/style";
import {
  ComposerSheet,
  MonthView,
  PlannerBook,
  TimeboxSheet,
  WeekGrid,
  localDate,
  useTasksLive,
} from "@/features/tasks";
import { PX_DEFAULT, PX_MAX, PX_MIN, PxPerMinProvider, clampPx } from "@/features/tasks/timeGrid";
import { addDays, toLocalNoon, weekOf } from "@/features/tasks/dates";
import { useMonthProjectDots } from "@/features/learning";
import { useAuthStore } from "@/stores";

type View = "day" | "week" | "month";

export function Calendar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <>
      <Masthead avatar={<PageDoodle page="calendar" />} title="Calendar" />
      {isAuthenticated ? <CalendarBody /> : <SignedOut />}
    </>
  );
}

function CalendarBody() {
  useTasksLive();
  const [view, setView] = useState<View>("week");
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const monthDots = useMonthProjectDots(month);
  const week = weekOf(selected);
  const today = localDate();
  // The tapped slot that opens the task drawer, Google-Calendar style.
  const [slot, setSlot] = useState<{ date: string; start: number } | null>(null);
  const addAt = (date: string, start: number) => setSlot({ date, start });
  // Vertical time zoom (day + week grids), in px per minute — pinch or step it.
  const [px, setPx] = useState(PX_DEFAULT);
  const pinchRef = usePinchZoom(setPx);

  const go = (dir: -1 | 1) => {
    setDirection(dir);
    setSelected((d) => addDays(d, dir * (view === "day" ? 1 : 7)));
  };
  const openDay = (date: string) => {
    setDirection(date >= selected ? 1 : -1);
    setSelected(date);
    setView("day");
  };

  const weekLabel = `${toLocalNoon(week[0]).toLocaleDateString("en", { month: "short", day: "numeric" })} – ${toLocalNoon(week[6]).toLocaleDateString("en", { month: "short", day: "numeric" })}`;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ViewToggle
          view={view}
          onChange={(v) => {
            if (v === "month") setMonth(selected.slice(0, 7));
            setView(v);
          }}
        />
        {view !== "month" && (
          <span className="flex items-center gap-1">
            <AnimatePresence>
              {selected !== today && (
                <motion.button
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 4 }}
                  onClick={() => {
                    setDirection(selected > today ? -1 : 1);
                    setSelected(today);
                  }}
                  className="mr-1 text-[10px] uppercase tracking-[0.18em] text-zest transition-transform active:scale-95"
                >
                  today
                </motion.button>
              )}
            </AnimatePresence>
            <NavButton label={view === "day" ? "Previous day" : "Previous week"} onClick={() => go(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </NavButton>
            {view === "week" && (
              <span className="min-w-28 text-center text-[11px] font-medium tabular-nums text-ink-muted">
                {weekLabel}
              </span>
            )}
            <NavButton label={view === "day" ? "Next day" : "Next week"} onClick={() => go(1)}>
              <ChevronRight className="h-4 w-4" />
            </NavButton>
          </span>
        )}
      </div>

      {view !== "month" && (
        <PxPerMinProvider value={px}>
          <div ref={pinchRef} style={{ touchAction: "pan-y" }}>
            {view === "day" && (
              <div className="mt-9">
                <PlannerBook page={selected} direction={direction}>
                  <TimeboxSheet date={selected} onAddSlot={addAt} />
                </PlannerBook>
              </div>
            )}
            {view === "week" && (
              <motion.div
                key={week[0]}
                initial={{ opacity: 0, x: direction * 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="mt-4"
              >
                <Panel className="p-4 md:p-5">
                  <WeekGrid anchor={selected} onPickDay={openDay} onAddSlot={addAt} />
                </Panel>
              </motion.div>
            )}
          </div>
          <ZoomStepper
            onIn={() => setPx((p) => clampPx(p * 1.4))}
            onOut={() => setPx((p) => clampPx(p / 1.4))}
            canIn={px < PX_MAX - 0.001}
            canOut={px > PX_MIN + 0.001}
          />
        </PxPerMinProvider>
      )}

      {view === "month" && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="mt-4"
        >
          <Panel className="p-4 md:p-5">
            <MonthView
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={openDay}
              onToggleView={() => setView("week")}
              sessionDots={monthDots}
            />
          </Panel>
        </motion.div>
      )}

      {/* Tap a slot → the task drawer opens at that time, Google-Calendar style. */}
      <AnimatePresence>
        {slot && (
          <ComposerSheet
            date={slot.date}
            initialStart={slot.start}
            onClose={() => setSlot(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Pinch (two fingers) or ctrl/⌘-scroll on the grid to zoom the time axis.
 * Non-passive listeners so the browser's own page-zoom is suppressed. */
function usePinchZoom(setPx: (fn: (p: number) => number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spanOf = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    let start: { span: number; px: number } | null = null;
    let base = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        setPx((p) => {
          start = { span: spanOf(e.touches), px: p };
          return p;
        });
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && start) {
        e.preventDefault();
        const ratio = spanOf(e.touches) / start.span;
        const target = clampPx(start.px * ratio);
        setPx(() => target);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // trackpad pinch arrives as ctrl+wheel
      e.preventDefault();
      base = e.deltaY;
      setPx((p) => clampPx(p * (1 - base * 0.01)));
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [setPx]);
  return ref;
}

/** Time zoom: a small vertical stepper floating above the dock. Taller hours
 * on zoom-in, more of the day on zoom-out — the counterpart to pinching. */
function ZoomStepper({
  onIn,
  onOut,
  canIn,
  canOut,
}: {
  onIn: () => void;
  onOut: () => void;
  canIn: boolean;
  canOut: boolean;
}) {
  return (
    <div className="fixed bottom-20 right-4 z-30 flex flex-col overflow-hidden rounded-full border border-rule/70 bg-surface/90 shadow-soft backdrop-blur-md md:bottom-24 md:right-8">
      <button
        type="button"
        onClick={onIn}
        disabled={!canIn}
        aria-label="Zoom in"
        title="Zoom in"
        className="flex h-10 w-10 items-center justify-center text-ink transition-colors hover:bg-ink/5 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
      <span className="mx-auto h-px w-5 bg-rule/70" aria-hidden />
      <button
        type="button"
        onClick={onOut}
        disabled={!canOut}
        aria-label="Zoom out"
        title="Zoom out"
        className="flex h-10 w-10 items-center justify-center text-ink transition-colors hover:bg-ink/5 disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Day / Week / Month — keys in the same pressed tray the planner uses. */
function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div className="inset-well flex rounded-full bg-ink/5 p-1">
      {(["day", "week", "month"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={cn(
            "relative h-7 rounded-full px-3.5 text-[11px] font-medium capitalize transition-colors",
            view === v ? "text-ink" : "text-ink-muted hover:text-ink",
          )}
        >
          {view === v && (
            <motion.span
              layoutId="calendar-view"
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className="absolute inset-0 rounded-full border border-rule/70 bg-surface shadow-soft"
            />
          )}
          <span className="relative">{v}</span>
        </button>
      ))}
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted/70 transition-[color,transform] hover:text-ink active:scale-90"
    >
      {children}
    </button>
  );
}

function SignedOut() {
  return (
    <Panel className="mt-8 p-8 md:p-10">
      <Eyebrow>calendar</Eyebrow>
      <h2 className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
        Your hours, mapped.
      </h2>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
        <Link to="/account" className="text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>{" "}
        to see your days, weeks and months laid out in time.
      </p>
    </Panel>
  );
}
