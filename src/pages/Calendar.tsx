// The Calendar space / "/calendar" route (unit 5.1, ported from src-legacy/pages/Calendar.tsx onto
// Lynx): a day / week / month view switch over the same seeded, dated tasks. Week and month render
// statically here; the +/- ZoomStepper scales the time axis (web-parity zoom). All drag gesture
// (block move/resize, pinch-zoom) is unit 5.2.
//
// DROPPED (recorded BROOM): `motion`/`AnimatePresence` -> CSS: the week swap + month drop are
// keyed-remount CSS keyframes (animate-cal-week / animate-cal-month in styles/global.css, reduced
// -> animate-enter-fade); the ViewToggle layoutId pill -> a positioned highlight <view> with a
// left/width CSS transition; the AnimatePresence "today" button -> a plain conditional <view>.
// `usePinchZoom` (the whole DOM touch/wheel hook: addEventListener + getBoundingClientRect +
// window.scrollY, all R11-forbidden on the web worker) -> DROPPED; the +/- ZoomStepper is the
// web-parity zoom control and MTS pinch is PARKED (device polish). `lucide-react` -> the L2 icon
// set (unit 2.4). `<Link>`'s <a> is unsupported by the Lynx web host (dock 3.3 finding) -> the
// SignedOut sign-in link is a <view bindtap> + useNavigate(). SCROLLING (crib "<scroll-view>"): the
// L3 shell wraps page content in no vertical scroller and the host <lynx-view> is a fixed 100vh, so
// the tall day/week canvas ((DAY_END-DAY_START)*px >= 1020px) is wrapped in a <scroll-view
// scroll-orientation="vertical"> (renders all children, unlike <list>). Elements: <div>/<button>
// -> <view bindtap>, <span>/<h2>/<p> -> <text> (explicit colour + size on every <text>).
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Masthead } from "@/components/masthead";
import { Panel, Eyebrow } from "@/components/surface";
import { ChevronLeft, ChevronRight, Minus, Plus } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { PageDoodle } from "@/features/style";
import { useAuthStore, useReducedMotion } from "@/stores";
import {
  ComposerSheet,
  MonthView,
  PlannerBook,
  TimeboxSheet,
  WeekGrid,
  localDate,
  useTasksLive,
  useCalendarEventsLive,
  useDayEvents,
  useWeekEvents,
} from "@/features/tasks";
import { PX_DEFAULT, PX_MAX, PX_MIN, PxPerMinProvider, clampPx } from "@/features/tasks/timeGrid";
import { addDays, toLocalNoon, weekOf } from "@/features/tasks/dates";

type View = "day" | "week" | "month";

export function Calendar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <view data-testid="page-calendar">
      <Masthead avatar={<PageDoodle page="calendar" />} title="Calendar" />
      {isAuthenticated ? <CalendarBody /> : <SignedOut />}
    </view>
  );
}

function CalendarBody() {
  useTasksLive();
  useCalendarEventsLive();
  const reduced = useReducedMotion();
  const [view, setView] = useState<View>("week");
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const week = weekOf(selected);
  const today = localDate();
  // Read-only Google events (unit 5.3, R2): the week map for the WeekGrid columns and the selected
  // day's list for the TimeboxSheet. Both render as non-draggable, read-only blocks (no handlers).
  const weekEvents = useWeekEvents(selected);
  const dayEvents = useDayEvents(selected);
  // The tapped slot that opens the task drawer, Google-Calendar style.
  const [slot, setSlot] = useState<{ date: string; start: number } | null>(null);
  const addAt = (date: string, start: number) => setSlot({ date, start });
  // Vertical time zoom (day + week grids), in px per minute -- step it with the +/- ZoomStepper.
  const [px, setPx] = useState(PX_DEFAULT);

  const go = (dir: -1 | 1) => {
    setDirection(dir);
    setSelected((d) => addDays(d, dir * (view === "day" ? 1 : 7)));
  };
  const openDay = (date: string) => {
    setDirection(date >= selected ? 1 : -1);
    setSelected(date);
    setView("day");
  };

  const weekLabel = `${toLocalNoon(week[0]).toLocaleDateString("en", { month: "short", day: "numeric" })} - ${toLocalNoon(week[6]).toLocaleDateString("en", { month: "short", day: "numeric" })}`;

  return (
    <view className="mt-6">
      <view className="flex flex-wrap items-center justify-between gap-2">
        <ViewToggle
          view={view}
          onChange={(v) => {
            if (v === "month") setMonth(selected.slice(0, 7));
            setView(v);
          }}
        />
        {view !== "month" && (
          <view className="flex items-center gap-1">
            {selected !== today && (
              <view
                bindtap={() => {
                  setDirection(selected > today ? -1 : 1);
                  setSelected(today);
                }}
                accessibility-label="Back to today"
                accessibility-traits="button"
                data-testid="cal-today"
                className="mr-1 animate-enter-fade active:scale-95"
              >
                <text className="text-[10px] uppercase tracking-[0.18em] text-zest">today</text>
              </view>
            )}
            <NavButton label={view === "day" ? "Previous day" : "Previous week"} onClick={() => go(-1)}>
              <ChevronLeft className="h-4 w-4 text-ink-muted" />
            </NavButton>
            {view === "week" && (
              <text className="min-w-28 text-center text-[11px] font-medium tabular-nums text-ink-muted">
                {weekLabel}
              </text>
            )}
            <NavButton label={view === "day" ? "Next day" : "Next week"} onClick={() => go(1)}>
              <ChevronRight className="h-4 w-4 text-ink-muted" />
            </NavButton>
          </view>
        )}
      </view>

      {view !== "month" && (
        <PxPerMinProvider value={px}>
          <scroll-view
            scroll-orientation="vertical"
            data-testid="calendar-scroll"
            className="h-[calc(100dvh_-_13rem)]"
          >
            {view === "day" && (
              <view className="mt-9">
                <PlannerBook page={selected} direction={direction}>
                  <TimeboxSheet date={selected} onAddSlot={addAt} extern={dayEvents.data ?? []} />
                </PlannerBook>
              </view>
            )}
            {view === "week" && (
              <view key={week[0]} className={cn("mt-4", reduced ? "animate-enter-fade" : "animate-cal-week")}>
                <Panel className="p-4 md:p-5">
                  <WeekGrid
                    anchor={selected}
                    onPickDay={openDay}
                    onAddSlot={addAt}
                    externsByDay={weekEvents.data ?? {}}
                  />
                </Panel>
              </view>
            )}
          </scroll-view>
          <ZoomStepper
            onIn={() => setPx((p) => clampPx(p * 1.4))}
            onOut={() => setPx((p) => clampPx(p / 1.4))}
            canIn={px < PX_MAX - 0.001}
            canOut={px > PX_MIN + 0.001}
          />
        </PxPerMinProvider>
      )}

      {view === "month" && (
        <view className={cn("mt-4", reduced ? "animate-enter-fade" : "animate-cal-month")}>
          <Panel className="p-4 md:p-5">
            <MonthView
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={openDay}
              onToggleView={() => setView("week")}
              // L6: sessionDots={useMonthProjectDots(month)}
              sessionDots={{}}
            />
          </Panel>
        </view>
      )}

      {/* Tap a slot -> the task drawer opens at that time, Google-Calendar style. */}
      {slot && (
        <ComposerSheet date={slot.date} initialStart={slot.start} onClose={() => setSlot(null)} />
      )}
    </view>
  );
}

/** Time zoom: a small vertical stepper floating above the dock. Taller hours on zoom-in, more of
 * the day on zoom-out. */
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
    <view className="fixed bottom-20 right-4 z-40 flex flex-col overflow-hidden rounded-full border border-rule/70 bg-surface/90 shadow-soft md:bottom-24 md:right-8">
      <view
        bindtap={canIn ? onIn : undefined}
        user-interaction-enabled={canIn}
        accessibility-label="Zoom in"
        accessibility-traits="button"
        data-testid="zoom-in"
        className={cn("flex h-10 w-10 items-center justify-center active:scale-90", !canIn && "opacity-30")}
      >
        <Plus className="h-4 w-4 text-ink" />
      </view>
      <view className="mx-auto h-px w-5 bg-rule/70" aria-hidden />
      <view
        bindtap={canOut ? onOut : undefined}
        user-interaction-enabled={canOut}
        accessibility-label="Zoom out"
        accessibility-traits="button"
        data-testid="zoom-out"
        className={cn("flex h-10 w-10 items-center justify-center active:scale-90", !canOut && "opacity-30")}
      >
        <Minus className="h-4 w-4 text-ink" />
      </view>
    </view>
  );
}

/** Day / Week / Month switch. The active pill is a positioned highlight <view> that eases under the
 * tapped segment (left/width CSS transition; no motion layoutId -- Lynx has no shared-element layout
 * animation, so this approximates it, degrading to an instant swap if the transition doesn't hold). */
function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const views: View[] = ["day", "week", "month"];
  const idx = views.indexOf(view);
  return (
    <view className="inset-well relative flex rounded-full bg-ink/5 p-1" data-testid="view-toggle">
      <view
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full border border-rule/70 bg-surface shadow-soft transition-[left] duration-200 ease-out"
        style={{ left: `calc(${idx} * (100% - 8px) / 3 + 4px)`, width: `calc((100% - 8px) / 3)` }}
      />
      {views.map((v) => (
        <view
          key={v}
          bindtap={() => onChange(v)}
          accessibility-label={v}
          accessibility-traits="button"
          accessibility-value={view === v ? "selected" : undefined}
          data-testid={`view-${v}`}
          className="relative z-10 flex h-7 flex-1 items-center justify-center px-3.5 active:scale-95"
        >
          <text
            className={cn(
              "text-[11px] font-medium capitalize",
              view === v ? "text-ink" : "text-ink-muted",
            )}
          >
            {v}
          </text>
        </view>
      ))}
    </view>
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
    <view
      bindtap={onClick}
      accessibility-label={label}
      accessibility-traits="button"
      className="flex h-7 w-7 items-center justify-center rounded-lg active:scale-90"
    >
      {children}
    </view>
  );
}

function SignedOut() {
  const navigate = useNavigate();
  return (
    <Panel className="mt-8 p-8 md:p-10">
      <Eyebrow>calendar</Eyebrow>
      <text className="mt-2 block max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
        Your hours, mapped.
      </text>
      <text className="mt-4 block max-w-xl text-lg leading-relaxed text-ink-muted">
        <text
          bindtap={() => navigate({ to: "/account" })}
          accessibility-label="Sign in"
          accessibility-traits="link"
          className="text-ink underline underline-offset-4"
        >
          Sign in
        </text>{" "}
        to see your days, weeks and months laid out in time.
      </text>
    </Panel>
  );
}
