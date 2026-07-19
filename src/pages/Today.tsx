import { useState } from "react";
import { motion } from "motion/react";
import { Panel, Eyebrow } from "@/components/surface";
import { Link } from "@tanstack/react-router";
import {
  AgendaSheet,
  MonthView,
  PlannerBook,
  TaskComposer,
  WeekStrip,
  localDate,
  useTasksLive,
} from "@/features/tasks";
import { useMonthProjectDots } from "@/features/learning";
import { useAuthStore } from "@/stores";

/** No masthead here: the sheet names its own day, the slider below shows the
 * month — the pad starts at the top of the page. */
export function Today() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Planner /> : <SignedOut />;
}

/** The planner pad up top, the date slider floating just above the dock —
 * thumb-reach on a phone, out of the content's way everywhere. Switching days
 * flips the page over the rings, desk-calendar style. */
function Planner() {
  useTasksLive();
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [view, setView] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const monthSessionDots = useMonthProjectDots(month);

  const select = (date: string) => {
    if (date === selected) return;
    setDirection(date > selected ? 1 : -1);
    setSelected(date);
  };

  return (
    <>
      {/* The date slider: a raised shelf at the top of the pad. Month view
          grows out of the same shelf. */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="grain rounded-3xl border border-rule/70 bg-surface/95 px-3 py-2 shadow-soft"
      >
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {view === "week" ? (
            <WeekStrip
              selected={selected}
              onSelect={select}
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
                select(d);
                setView("week");
              }}
              onToggleView={() => setView("week")}
              sessionDots={monthSessionDots}
            />
          )}
        </motion.div>
      </motion.div>

      <div className="mt-8 pb-4">
        <PlannerBook page={selected} direction={direction}>
          <AgendaSheet date={selected} />
        </PlannerBook>
      </div>

      <TaskComposer date={selected} />
    </>
  );
}

function SignedOut() {
  return (
    <Panel className="mt-4 p-8 md:p-10">
      <Eyebrow>planner</Eyebrow>
      <h2 className="mt-2 max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink">
        Your day, kept.
      </h2>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
        Tasks live in your account so they follow you between devices —{" "}
        <Link to="/account" className="text-ink underline-offset-4 hover:underline">
          sign in
        </Link>{" "}
        (Account, in the dock below) to see today&apos;s list and add to it.
      </p>
    </Panel>
  );
}
