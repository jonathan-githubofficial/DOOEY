// The Planner space / "/" route (unit 4.1, ported from src-legacy/pages/Today.tsx onto Lynx): the
// day's one-shot tasks in a top-bound flip-pad, minimum-friction quick-add, and the signed-out
// state. A signed-in user opens the app, sees today's list, adds a task, and it appears without a
// reload (realtime through useTasksLive + the L1 lynx.EventSource seam).
//
// DROPPED (recorded BROOM): the `motion`/`motion.div` slider wrappers -> gone with the date slider
// itself. DEFERRED-to-5.1: the WeekStrip/MonthView date shelf, the `view`/`month`/`monthSessionDots`
// state, and useMonthProjectDots - replaced here by a MINIMAL prev/next day stepper (SPEC 3) that
// keeps the direction-aware page-flip meaningful and testable until 5.1 restores the full shelf.
// DEFERRED-to-5.3 (R2/R5): calendar-event lines in Today - AgendaSheet is mounted with NO `extern`
// prop (its default `[]`), so the event-interleave seam is kept but unfed here (no L4 unit brooms
// it). DROP/STOP-1 (R1): recurring habits do NOT exist in today's app (schema + UI both absent);
// building them is net-new pb_migrations work (HIGH-RISK, forbidden) - recorded as a parity gap for
// unit 8.4, nothing to port. `<Link>` -> navigate({ to }) on a `<text bindtap>` (crib; memory
// router has no <a>). Elements: <div>/<h2>/<p> -> <view>/<text>; <text> sets its own colour/font.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Panel, Eyebrow } from "@/components/surface";
import { ChevronLeft, ChevronRight } from "@/components/icons/lucide";
import { useAuthStore } from "@/stores";
import { localDate, useTasksLive } from "@/features/tasks/api";
import { addDays } from "@/features/tasks/dates";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { AgendaSheet } from "@/features/tasks/components/AgendaSheet";
import { TaskComposer } from "@/features/tasks/components/TaskComposer";

/** No masthead here: the sheet names its own day, the pad starts at the top of the page. */
export function Today() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Planner /> : <SignedOut />;
}

/** The planner pad up top, the day stepper just above it, the quick-add stamp floating above the
 * dock. Switching days flips the page over the rings, desk-calendar style. */
function Planner() {
  useTasksLive();
  const [selected, setSelected] = useState(localDate());
  const [direction, setDirection] = useState(1);
  const isToday = selected === localDate();

  // The `direction` state feeds the flip; a step in +/- days sets it before the day changes so the
  // PlannerBook peels the right way (full week paging returns with the 5.1 shelf).
  const step = (n: number) => {
    const d = addDays(selected, n);
    setDirection(n);
    setSelected(d);
  };
  const reset = () => {
    const today = localDate();
    setDirection(today > selected ? 1 : -1);
    setSelected(today);
  };

  return (
    <>
      {/* Minimal day stepper - a raised shelf standing in for the deferred WeekStrip/MonthView
          slider (5.1). Prev / next step a day; a "today" reset appears when off today. */}
      <view className="grain flex items-center justify-between gap-2 rounded-3xl border border-rule/70 bg-surface/95 px-3 py-2 shadow-soft">
        <view
          bindtap={() => step(-1)}
          user-interaction-enabled={true}
          accessibility-label="Previous day"
          accessibility-traits="button"
          data-testid="day-prev"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-surface active:scale-90"
        >
          <ChevronLeft className="h-4 w-4 text-ink-muted" />
        </view>

        {isToday ? (
          <view className="h-7" />
        ) : (
          <view
            bindtap={reset}
            user-interaction-enabled={true}
            accessibility-label="Back to today"
            accessibility-traits="button"
            data-testid="day-today"
            className="rounded-full border border-zest/40 bg-zest/10 px-3 py-1 active:scale-95"
          >
            <text className="text-xs font-medium uppercase tracking-[0.14em] text-zest">today</text>
          </view>
        )}

        <view
          bindtap={() => step(1)}
          user-interaction-enabled={true}
          accessibility-label="Next day"
          accessibility-traits="button"
          data-testid="day-next"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-surface active:scale-90"
        >
          <ChevronRight className="h-4 w-4 text-ink-muted" />
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
