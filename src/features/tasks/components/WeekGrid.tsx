import { memo, useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import type { AgendaExternal, Task } from "../types";
import { localDate, useDayTasks, useUpdateTask } from "../api";
import { dateOnly, toLocalNoon, toPbDate, weekOf } from "../dates";
import {
  DAY_END,
  DAY_START,
  GUTTER,
  SNAP,
  clamp,
  fmtMin,
  layoutLanes,
  snap,
  usePxPerMin,
} from "../timeGrid";
import { HourRules } from "./TimeboxSheet";

/** The week spread: seven ruled columns over one set of hours. Slips drag
 * anywhere — up and down to change time, across to change day — and a dashed
 * ghost shows the slot they'll land in. Tap a day's header to open it. */

type Ghost = { day: string; start: number; dur: number } | null;

export function WeekGrid({
  anchor,
  onPickDay,
  onAddSlot,
  externsByDay = {},
}: {
  anchor: string;
  onPickDay: (date: string) => void;
  onAddSlot?: (date: string, startMin: number) => void;
  externsByDay?: Record<string, AgendaExternal[]>;
}) {
  const days = weekOf(anchor);
  const today = localDate();
  const update = useUpdateTask();
  const gridRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<Ghost>(null);
  const pxPerMin = usePxPerMin();

  const mutate = update.mutate;

  /** Which day-column and minute a page-coordinate points at — or null. */
  const resolvePoint = useCallback(
    (pageX: number, pageY: number): { day: string; min: number } | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX + GUTTER;
      const width = rect.width - GUTTER;
      if (pageX < left || pageX > left + width) return null;
      if (pageY < top - 10 || pageY > top + rect.height + 10) return null;
      return {
        day: days[clamp(Math.floor(((pageX - left) / width) * 7), 0, 6)],
        min: clamp(snap(DAY_START + (pageY - top) / pxPerMin), DAY_START, DAY_END - SNAP),
      };
    },
    [days, pxPerMin],
  );

  // Stable so memoized week blocks don't re-render every drag frame.
  const preview = useCallback(
    (dur: number, pageX: number, pageY: number) => {
      const p = resolvePoint(pageX, pageY);
      setGhost(p ? { day: p.day, start: p.min, dur } : null);
    },
    [resolvePoint],
  );

  const drop = useCallback(
    (task: Task, fromDay: string, pageX: number, pageY: number) => {
      const p = resolvePoint(pageX, pageY);
      setGhost(null);
      if (!p || (p.min === task.start_min && p.day === fromDay)) return;
      mutate({
        id: task.id,
        patch: { start_min: p.min, ...(p.day !== fromDay ? { due_date: toPbDate(p.day) } : {}) },
      });
    },
    [resolvePoint, mutate],
  );

  /** Column + snapped minute for a click at viewport coords. */
  const slotFromClient = (clientX: number, clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    const width = rect.width;
    const idx = clamp(Math.floor((clientX - rect.left) / (width / 7)), 0, 6);
    const min = clamp(snap(DAY_START + (clientY - rect.top) / pxPerMin), DAY_START, DAY_END - SNAP);
    return { day: days[idx], start: min };
  };

  const ghostIdx = ghost ? days.indexOf(ghost.day) : -1;

  return (
    <div className="select-none">
      <div className="grid grid-cols-7" style={{ marginLeft: GUTTER }}>
        {days.map((d) => (
          <DayHeader key={d} day={d} isToday={d === today} onPick={() => onPickDay(d)} />
        ))}
      </div>

      <div className="mt-1">
        <HourRules date={days.includes(today) ? today : days[0]} gridRef={gridRef}>
          {/* Tappable empty grid, under the blocks. */}
          {onAddSlot && (
            <button
              type="button"
              aria-label="Add a task at this time"
              onClick={(e) => {
                const s = slotFromClient(e.clientX, e.clientY);
                onAddSlot(s.day, s.start);
              }}
              className="absolute inset-0 z-0 cursor-copy"
            />
          )}
          {days.slice(1).map((d, i) => (
            <div
              key={d}
              aria-hidden
              className="absolute inset-y-0 border-l border-rule/40"
              style={{ left: `${((i + 1) / 7) * 100}%` }}
            />
          ))}

          {ghost && ghostIdx >= 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pointer-events-none absolute z-20 rounded-lg border-2 border-dashed border-zest/50 bg-zest/[0.06]"
              style={{
                top: (ghost.start - DAY_START) * pxPerMin,
                height: ghost.dur * pxPerMin,
                left: `calc(${(ghostIdx / 7) * 100}% + 1px)`,
                width: `calc(${100 / 7}% - 3px)`,
              }}
            >
              <span className="absolute -top-2.5 left-1 whitespace-nowrap rounded-full border border-zest/40 bg-surface px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-zest shadow-soft">
                {fmtMin(ghost.start)}
              </span>
            </motion.div>
          )}

          {days.map((d, i) => (
            <WeekColumn
              key={d}
              day={d}
              index={i}
              externs={externsByDay[d] ?? EMPTY_EXTERNS}
              onPreview={preview}
              onDrop={drop}
            />
          ))}
        </HourRules>
      </div>
    </div>
  );
}

function DayHeader({
  day,
  isToday,
  onPick,
}: {
  day: string;
  isToday: boolean;
  onPick: () => void;
}) {
  const noon = toLocalNoon(day);
  return (
    <button
      onClick={onPick}
      title={noon.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
      className="group flex flex-col items-center gap-0.5 rounded-xl py-1 transition-colors hover:bg-ink/[0.04]"
    >
      <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted">
        {noon.toLocaleDateString("en", { weekday: "narrow" })}
      </span>
      <span
        className={cn(
          "font-display text-base font-bold leading-none tracking-tight",
          isToday ? "text-zest" : "text-ink group-hover:text-ink",
        )}
      >
        {noon.getDate()}
      </span>
    </button>
  );
}

/** One day's lane of slips. A task belongs to its due day (undated open tasks
 * ride on today), so nothing shows twice across the spread. Memoized: with
 * stable callbacks it skips re-render while another column's block drags. */
const WeekColumn = memo(function WeekColumn({
  day,
  index,
  externs,
  onPreview,
  onDrop,
}: {
  day: string;
  index: number;
  externs: AgendaExternal[];
  onPreview: (dur: number, pageX: number, pageY: number) => void;
  onDrop: (task: Task, fromDay: string, pageX: number, pageY: number) => void;
}) {
  const { data: tasks } = useDayTasks(day);
  const today = localDate();
  const open = (tasks ?? []).filter(
    (t) => !t.done_at && (t.due_date ? dateOnly(t.due_date) === day : day === today),
  );
  const scheduled = open.filter((t) => t.start_min > 0);
  const sessions = externs.filter((e) => !e.done && (e.startMin ?? 0) > 0);
  // Tasks and sessions share the overlap layout, so they don't stack on top.
  const lanes = layoutLanes([
    ...scheduled.map((t) => ({ id: t.id, start_min: t.start_min, dur_min: t.dur_min })),
    ...sessions.map((s) => ({ id: s.id, start_min: s.startMin!, dur_min: s.durMin! })),
  ]);

  return (
    // Transparent to pointers so taps on empty grid reach the add-catcher
    // beneath; the blocks re-enable pointers for their own drag.
    <div
      className="pointer-events-none absolute inset-y-0"
      style={{ left: `${(index / 7) * 100}%`, width: `${100 / 7}%` }}
    >
      {scheduled.map((t) => (
        <WeekBlock
          key={t.id}
          task={t}
          day={day}
          lane={lanes.get(t.id) ?? SOLO_LANE}
          onPreview={onPreview}
          onDrop={onDrop}
        />
      ))}
      {sessions.map((s) => (
        <WeekSessionBlock key={s.id} ext={s} lane={lanes.get(s.id) ?? SOLO_LANE} />
      ))}
    </div>
  );
});

const SOLO_LANE = { lane: 0, lanes: 1 };
const EMPTY_EXTERNS: AgendaExternal[] = [];

/** A timeboxed learning session in the week spread. Read-only here — it links
 * to its page; adjust its time in the day view. */
const WeekSessionBlock = memo(function WeekSessionBlock({
  ext,
  lane,
}: {
  ext: AgendaExternal;
  lane: { lane: number; lanes: number };
}) {
  const pxPerMin = usePxPerMin();
  const height = (ext.durMin ?? 60) * pxPerMin;
  return (
    <Link
      to={ext.to}
      params={ext.params}
      className="grain pointer-events-auto absolute overflow-hidden rounded-lg border border-rule/70 bg-surface shadow-soft"
      style={{
        top: ((ext.startMin ?? 0) - DAY_START) * pxPerMin,
        height,
        left: `calc(${(lane.lane / lane.lanes) * 100}% + 1px)`,
        width: `calc(${100 / lane.lanes}% - 3px)`,
      }}
    >
      <span className={cn("absolute inset-y-1 left-0.5 w-[2px] rounded-full", ext.accentClass)} aria-hidden />
      <span className="block h-full pl-2 pr-1 pt-0.5">
        <span className="block truncate text-[10px] font-medium leading-tight text-ink">
          {ext.gate && <span className="text-zest">⛳</span>} {ext.title}
        </span>
        {height >= 34 && (
          <span className="block text-[9px] tabular-nums leading-tight text-ink-muted">
            {fmtMin(ext.startMin ?? 0)}
          </span>
        )}
      </span>
    </Link>
  );
});

const WeekBlock = memo(function WeekBlock({
  task,
  day,
  lane,
  onPreview,
  onDrop,
}: {
  task: Task;
  day: string;
  lane: { lane: number; lanes: number };
  onPreview: (dur: number, pageX: number, pageY: number) => void;
  onDrop: (task: Task, fromDay: string, pageX: number, pageY: number) => void;
}) {
  const dragging = useRef(false);
  const pxPerMin = usePxPerMin();
  const height = task.dur_min * pxPerMin;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.08}
      dragSnapToOrigin
      onDragStart={() => (dragging.current = true)}
      onDrag={(_e, info) => onPreview(task.dur_min, info.point.x, info.point.y)}
      onDragEnd={(_e, info) => {
        onDrop(task, day, info.point.x, info.point.y);
        setTimeout(() => (dragging.current = false), 0);
      }}
      onClickCapture={(e) => {
        if (dragging.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileDrag={{
        scale: 1.04,
        rotate: -0.6,
        zIndex: 30,
        boxShadow: "0 6px 18px -6px rgb(40 32 24 / 0.35)",
      }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="grain pointer-events-auto absolute cursor-grab touch-none overflow-hidden rounded-lg border border-rule/70 bg-surface shadow-soft active:cursor-grabbing"
      style={{
        top: (task.start_min - DAY_START) * pxPerMin,
        height,
        left: `calc(${(lane.lane / lane.lanes) * 100}% + 1px)`,
        width: `calc(${100 / lane.lanes}% - 3px)`,
      }}
    >
      <span className="absolute inset-y-1 left-0.5 w-[2px] rounded-full bg-zest/70" aria-hidden />
      <Link
        to="/task/$id"
        params={{ id: task.id }}
        draggable={false}
        className="block h-full pl-2 pr-1 pt-0.5"
      >
        <p className="truncate text-[10px] font-medium leading-tight text-ink">{task.title}</p>
        {height >= 34 && (
          <p className="text-[9px] tabular-nums leading-tight text-ink-muted">
            {fmtMin(task.start_min)}
          </p>
        )}
      </Link>
    </motion.div>
  );
});
