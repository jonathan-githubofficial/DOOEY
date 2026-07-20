// The Planner space / "/" route (unit 4.1, ported from src-legacy/pages/Today.tsx onto Lynx): the
// day's one-shot tasks in a top-bound flip-pad, minimum-friction quick-add, and the signed-out
// state. A signed-in user opens the app, sees today's list, adds a task, and it appears without a
// reload (realtime through useTasksLive + the L1 lynx.EventSource seam).
//
// Unit 5.1 RESTORED the date shelf that 4.1 deferred: the WeekStrip ribbon (default) / MonthView
// grid (expanded) now sits above the planner pad, replacing 4.1's stand-in prev/next day stepper.
// Selecting a day in the shelf flips the pad to it (direction-aware). sessionDots={} at L5 (the real
// useMonthProjectDots is L6/learning, not ported yet -- see the call-site seam).
//
// DROPPED (recorded BROOM): the `motion`/`motion.div` slider wrappers -> gone with the date slider.
// DEFERRED-to-5.3 (R2/R5): calendar-event lines in Today - AgendaSheet is mounted with NO `extern`
// prop (its default `[]`), so the event-interleave seam is kept but unfed here (no L4 unit brooms
// it). DROP/STOP-1 (R1): recurring habits do NOT exist in today's app (schema + UI both absent);
// building them is net-new pb_migrations work (HIGH-RISK, forbidden) - recorded as a parity gap for
// unit 8.4, nothing to port. `<Link>` -> navigate({ to }) on a `<text bindtap>` (crib; memory
// router has no <a>). Elements: <div>/<h2>/<p> -> <view>/<text>; <text> sets its own colour/font.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Panel, Eyebrow } from "@/components/surface";
import { GrainOverlay } from "@/components/grain-overlay";
import { useAuthStore, useReducedMotion } from "@/stores";
import { MonthView, WeekStrip, localDate, useTasksLive } from "@/features/tasks";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { AgendaSheet } from "@/features/tasks/components/AgendaSheet";
import { TaskComposer } from "@/features/tasks/components/TaskComposer";

/** No masthead here: the sheet names its own day, the pad starts at the top of the page. */
export function Today() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Planner /> : <SignedOut />;
}

/** The date shelf up top, the planner pad below it, the quick-add stamp floating above the dock.
 * Selecting a day flips the page over the rings, desk-calendar style. */
function Planner() {
  useTasksLive();
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState(localDate());
  const [direction, setDirection] = useState(1);
  const [view, setView] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));

  // A day pick sets the flip direction before the day changes, so the PlannerBook peels the right
  // way (forward for a later day, back for an earlier one).
  const pick = (date: string) => {
    setDirection(date > selected ? 1 : -1);
    setSelected(date);
  };

  return (
    <>
      {/* The date shelf (restored from 4.1's defer): a raised, grained surface card holding the
          week ribbon / month grid - mirrors the DOM original's shelf wrapper
          (`grain rounded-3xl border border-rule/70 bg-surface/95 shadow-soft`), which the Lynx
          port had dropped (leaving the ribbon floating on the page). CSS enter on view swap (not
          motion); a keyed remount replays it. */}
      <view className="relative rounded-3xl border border-rule/70 bg-surface/95 px-3 py-2 shadow-soft">
        <GrainOverlay className="absolute inset-0 rounded-3xl" />
        <view
          key={view}
          className={reduced ? "animate-enter-fade" : view === "month" ? "animate-cal-month" : "animate-cal-week"}
        >
          {view === "week" ? (
            <WeekStrip
              selected={selected}
              onSelect={pick}
              onToggleView={() => {
                setMonth(selected.slice(0, 7));
                setView("month");
              }}
            />
          ) : (
            <MonthView
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={(d) => {
                pick(d);
                setView("week");
              }}
              onToggleView={() => setView("week")}
              // L6: sessionDots={useMonthProjectDots(month)}
              sessionDots={{}}
            />
          )}
        </view>
      </view>

      <view className="mt-8 pb-4">
        <PlannerBook page={selected} direction={direction}>
          <AgendaSheet date={selected} />
        </PlannerBook>
      </view>

      <TaskComposer date={selected} />
    </>
  );
}

/** The signed-out landing copy (kept verbatim). NOTE: on the web target the L3 `app` guard
 * redirects an invalid session to /login before "/" mounts, so this branch is not reached there
 * (the @l4 today-signedout spec asserts that guard redirect); it is ported for shape parity and
 * for hosts/contexts without the redirect guard. */
function SignedOut() {
  const navigate = useNavigate();
  return (
    <Panel className="mt-4 p-8 md:p-10">
      <Eyebrow>planner</Eyebrow>
      <text className="mt-2 block max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
        Your day, kept.
      </text>
      <text className="mt-4 block max-w-xl text-lg leading-relaxed text-ink-muted">
        Tasks live in your account so they follow you between devices —{" "}
        <text
          bindtap={() => navigate({ to: "/account" })}
          accessibility-label="sign in"
          accessibility-traits="link"
          className="text-ink underline underline-offset-4"
        >
          sign in
        </text>{" "}
        (Account, in the dock below) to see today&apos;s list and add to it.
      </text>
    </Panel>
  );
}
