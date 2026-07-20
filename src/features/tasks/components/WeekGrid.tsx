// The week spread (unit 5.1, ported from src-legacy/features/tasks/components/WeekGrid.tsx onto
// Lynx) -- RENDER ONLY. Seven ruled columns over one set of hours: day headers that tap to open a
// day, the hour rules, vertical day dividers, and statically-positioned task blocks laid out by
// start_min/dur_min via layoutLanes. Tap-to-open (DayHeader) and tap-empty-to-add (per-column
// catcher) are taps, not drags, so they stay; ALL drag/resize/drop gesture code is unit 5.2.
//
// DROPPED (recorded BROOM): `motion` (WeekBlock/ghost). DEFERRED-TO-5.2: WeekBlock's drag
// (drag/onDragStart/onDrag/onDragEnd/onClickCapture/whileDrag/dragging ref), the ghost preview
// state + <view>, resolvePoint()/preview()/drop()/slotFromClient() and the
// getBoundingClientRect/window.scroll math they used (R11-forbidden on the web worker anyway). In
// THIS unit a block is a static positioned <view bindtap=navigate> at top=(start-DAY_START)*px,
// height=dur*px, in its lane -- the "// 5.2:" seam marks the precise attach point.
//
// externsByDay retained as an empty-default seam for 5.3: no producer exists at L5 (learning
// sessions are real tasks now), so WeekSessionBlock never instantiates here; unit 5.3 revives it to
// render Google calendar_events. Elements: <div> -> <view>, <span>/<p> -> <text> (explicit
// colour + size on every <text>); <Link>'s <a> is unsupported by the Lynx web host (recorded by
// dock unit 3.3 / TimeboxSheet 4.3), so navigation is a <view bindtap> + useNavigate(), the shipped
// new-tree pattern.
import { useNavigate } from "@tanstack/react-router";

import { cn } from "@/lib/cn";
import type { AgendaExternal, Task } from "../types";
import { localDate, useDayTasks } from "../api";
import { dateOnly, toLocalNoon, weekOf } from "../dates";
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

const SOLO_LANE = { lane: 0, lanes: 1 };
const EMPTY_EXTERNS: AgendaExternal[] = [];

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

  return (
    <view className="select-none">
      <view className="flex" style={{ marginLeft: GUTTER }}>
        {days.map((d) => (
          <DayHeader key={d} day={d} isToday={d === today} onPick={() => onPickDay(d)} />
        ))}
      </view>

      <view className="mt-1">
        <HourRules date={days.includes(today) ? today : days[0]}>
          {days.slice(1).map((d, i) => (
            <view
              key={d}
              aria-hidden
              className="pointer-events-none absolute inset-y-0 border-l border-rule/40"
              style={{ left: `${((i + 1) / 7) * 100}%` }}
            />
          ))}

          {days.map((d, i) => (
            <WeekColumn
              key={d}
              day={d}
              index={i}
              externs={externsByDay[d] ?? EMPTY_EXTERNS}
              onAddSlot={onAddSlot}
            />
          ))}
        </HourRules>
      </view>
    </view>
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
    <view
      bindtap={onPick}
      accessibility-label={noon.toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      accessibility-traits="button"
      data-testid="week-day-header"
      data-day={day}
      className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 active:scale-95"
    >
      <text className="text-[9px] font-medium uppercase tracking-[0.14em] text-ink-muted">
        {noon.toLocaleDateString("en", { weekday: "narrow" })}
      </text>
      <text
        className={cn(
          "font-display text-base font-bold leading-none tracking-tight",
          isToday ? "text-zest" : "text-ink",
        )}
      >
        {noon.getDate()}
      </text>
    </view>
  );
}

/** One day's lane of slips. A task belongs to its due day (undated open tasks ride on today), so
 * nothing shows twice across the spread. Tasks and sessions share the overlap layout. */
function WeekColumn({
  day,
  index,
  externs,
  onAddSlot,
}: {
  day: string;
  index: number;
  externs: AgendaExternal[];
  onAddSlot?: (date: string, startMin: number) => void;
}) {
  const { data: tasks } = useDayTasks(day);
  const pxPerMin = usePxPerMin();
  const today = localDate();
  const open = (tasks ?? []).filter(
    (t) => !t.done_at && (t.due_date ? dateOnly(t.due_date) === day : day === today),
  );
  const scheduled = open.filter((t) => t.start_min > 0);
  const sessions = externs.filter((e) => !e.done && (e.startMin ?? 0) > 0);
  const lanes = layoutLanes([
    ...scheduled.map((t) => ({ id: t.id, start_min: t.start_min, dur_min: t.dur_min })),
    ...sessions.map((s) => ({ id: s.id, start_min: s.startMin!, dur_min: s.durMin! })),
  ]);

  // Empty-grid TAP -> open the composer at that time (a tap, not a drag). Element-relative touch Y
  // gives pixels from the column top (= the hour-area top), so no boundingClientRect is needed
  // (the DOM-rect math was dropped to 5.2). Mirrors TimeboxSheet's addAt (unit 4.3).
  const addAt = (e: { changedTouches?: { y: number }[]; detail?: { y: number } }) => {
    if (!onAddSlot) return;
    const y = e.changedTouches?.[0]?.y ?? e.detail?.y;
    const minute =
      y != null ? clamp(snap(DAY_START + y / pxPerMin), DAY_START, DAY_END - SNAP) : DAY_START;
    onAddSlot(day, minute);
  };

  return (
    <view className="absolute inset-y-0" style={{ left: `${(index / 7) * 100}%`, width: `${100 / 7}%` }}>
      {/* Tappable empty grid, under the blocks (a sibling, so taps on a block never fire it). */}
      {onAddSlot && (
        <view
          bindtap={addAt}
          accessibility-label="Add a task at this time"
          accessibility-traits="button"
          data-testid="week-add-slot"
          className="absolute inset-0 z-0"
        />
      )}
      {scheduled.map((t) => (
        <WeekBlock key={t.id} task={t} day={day} lane={lanes.get(t.id) ?? SOLO_LANE} />
      ))}
      {sessions.map((s) => (
        <WeekSessionBlock key={s.id} ext={s} lane={lanes.get(s.id) ?? SOLO_LANE} />
      ))}
    </view>
  );
}

/** A timeboxed learning session in the week spread (INERT seam for unit 5.3; never instantiated at
 * L5 since externsByDay is empty). Read-only -- it links to its page. */
function WeekSessionBlock({
  ext,
  lane,
}: {
  ext: AgendaExternal;
  lane: { lane: number; lanes: number };
}) {
  const navigate = useNavigate();
  const pxPerMin = usePxPerMin();
  const height = (ext.durMin ?? 60) * pxPerMin;
  return (
    <view
      bindtap={() => void navigate({ to: ext.to, params: ext.params } as never)}
      accessibility-traits="button"
      className="grain absolute overflow-hidden rounded-lg border border-rule/70 bg-surface shadow-soft active:opacity-70"
      style={{
        top: ((ext.startMin ?? 0) - DAY_START) * pxPerMin,
        height,
        left: `calc(${(lane.lane / lane.lanes) * 100}% + 1px)`,
        width: `calc(${100 / lane.lanes}% - 3px)`,
      }}
    >
      <view className={cn("absolute inset-y-1 left-0.5 w-[2px] rounded-full", ext.accentClass)} aria-hidden />
      <view className="h-full pl-2 pr-1 pt-0.5">
        <text className="truncate text-[10px] font-medium leading-tight text-ink">
          {ext.gate ? "⛳ " : ""}
          {ext.title}
        </text>
        {height >= 34 && (
          <text className="text-[9px] tabular-nums leading-tight text-ink-muted">
            {fmtMin(ext.startMin ?? 0)}
          </text>
        )}
      </view>
    </view>
  );
}

/** One boxed task in the week spread: a static positioned paper slip. 5.2 attaches the MTS drag. */
function WeekBlock({
  task,
  day,
  lane,
}: {
  task: Task;
  day: string;
  lane: { lane: number; lanes: number };
}) {
  const navigate = useNavigate();
  const pxPerMin = usePxPerMin();
  const height = task.dur_min * pxPerMin;
  const top = (task.start_min - DAY_START) * pxPerMin;

  return (
    // 5.2: MTS drag mounts here (main-thread:bindtouchstart/move/end reading element-relative
    // coords; setStyleProperty for the live drag, commit start_min/due_date via runOnBackground).
    <view
      bindtap={() => void navigate({ to: "/task/$id", params: { id: task.id } })}
      accessibility-label={task.title}
      accessibility-traits="button"
      data-testid="week-block"
      data-day={day}
      data-top={String(Math.round(top))}
      className="grain absolute overflow-hidden rounded-lg border border-rule/70 bg-surface shadow-soft active:opacity-70"
      style={{
        top,
        height,
        left: `calc(${(lane.lane / lane.lanes) * 100}% + 1px)`,
        width: `calc(${100 / lane.lanes}% - 3px)`,
      }}
    >
      <view className="absolute inset-y-1 left-0.5 w-[2px] rounded-full bg-zest/70" aria-hidden />
      <view className="h-full pl-2 pr-1 pt-0.5">
        <text className="truncate text-[10px] font-medium leading-tight text-ink">{task.title}</text>
        {height >= 34 && (
          <text className="text-[9px] tabular-nums leading-tight text-ink-muted">
            {fmtMin(task.start_min)}
          </text>
        )}
      </view>
    </view>
  );
}
