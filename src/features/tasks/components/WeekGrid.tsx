// The week spread (unit 5.1 static render -> unit 5.2 gesture layer, ruling R3). Seven ruled columns
// over one set of hours: day headers that tap to open a day, the hour rules, vertical day dividers,
// and task blocks laid out by start_min/dur_min via layoutLanes. This unit attaches the Main-Thread
// Scripting (MTS) cross-day drag the 5.1 render left as a seam: drag a WeekBlock up/down to change
// its time and across columns to change its day, committing start_min (+ due_date on a day change)
// to PocketBase on release.
//
// PORTED FROM (recorded BROOM, src-legacy already git-rm'd by 5.1): the `motion` WeekBlock drag and
// its resolvePoint()/preview()/drop() + getBoundingClientRect/window.scroll math. Re-authored as
// Lynx MTS `main-thread:bindtouch*` worklets. Cross-day is ABSOLUTE (SPEC 5): it needs the grid
// rectangle, measured on the BACKGROUND thread via
// `lynx.createSelectorQuery().select('#week-grid').invoke({method:'boundingClientRect'})` and mirrored
// into a MainThreadRef by `runOnMainThread` (measured at mount + refreshed at drag-start). On the web
// target both `touches[0].x/y` and boundingClientRect are LynxView-local, so grid-relative math
// subtracts rect.left/top directly; the column is `floor(((x - (left+GUTTER)) / (width-GUTTER)) * 7)`.
// The worklets, refs and block markup live in WeekColumn (a worklet binds only to a same-scope
// identifier and cannot call outer helpers, so WeekBlock is inlined and snap/clamp arithmetic is
// inlined; the constant `days`/GUTTER are captured, and per-block id/day/px ride as `data-*`). Unlike
// the day sheet, no separate ghost is driven here -- the block itself translates under the finger
// (its own MTS transform) as the live preview. Native coordinate semantics for the drop are PARKED.
//
// externsByDay stays an empty-default seam for 5.3 (WeekSessionBlock is read-only, never dragged).
// Elements: <div> -> <view>, <span>/<p> -> <text>; navigation is <view bindtap> + useNavigate().
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { runOnBackground, runOnMainThread, useMainThreadRef } from "@lynx-js/react";
import type { MainThread } from "@lynx-js/types";

import { cn } from "@/lib/cn";
import type { AgendaExternal, TaskPatch } from "../types";
import { localDate, useDayTasks, useUpdateTask } from "../api";
import { dateOnly, toLocalNoon, toPbDate, weekOf } from "../dates";
import { DAY_END, DAY_START, GUTTER, SNAP, fmtMin, layoutLanes, usePxPerMin } from "../timeGrid";
import { HourRules } from "./TimeboxSheet";

const SOLO_LANE = { lane: 0, lanes: 1 };
const EMPTY_EXTERNS: AgendaExternal[] = [];

type Mutate = (vars: { id: string; patch: TaskPatch }) => void;

/** Per-gesture state for a week block drag (JSON-serializable, held in a useMainThreadRef). The
 * target column + minute are computed from the absolute touch point during touchmove and read back
 * at touchend (where `touches` is empty). */
interface WeekDragState {
  mode: "" | "move";
  startX: number;
  startY: number;
  px: number;
  col: number;
  min: number;
  off: boolean;
  moved: boolean;
}

const INITIAL_WEEK_DRAG: WeekDragState = {
  mode: "",
  startX: 0,
  startY: 0,
  px: 1,
  col: -1,
  min: 0,
  off: true,
  moved: false,
};

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

  return (
    <view className="select-none">
      <view className="flex" style={{ marginLeft: GUTTER }}>
        {days.map((d) => (
          <DayHeader key={d} day={d} isToday={d === today} onPick={() => onPickDay(d)} />
        ))}
      </view>

      <view className="mt-1">
        <HourRules date={days.includes(today) ? today : days[0]} gridId="week-grid">
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
              days={days}
              mutate={update.mutate}
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
 * nothing shows twice across the spread. Tasks and sessions share the overlap layout. The MTS
 * cross-day drag worklets + their MainThreadRefs live here (same scope as the inlined WeekBlock). */
function WeekColumn({
  day,
  index,
  days,
  mutate,
  externs,
  onAddSlot,
}: {
  day: string;
  index: number;
  days: string[];
  mutate: Mutate;
  externs: AgendaExternal[];
  onAddSlot?: (date: string, startMin: number) => void;
}) {
  const { data: tasks } = useDayTasks(day);
  const pxPerMin = usePxPerMin();
  const today = localDate();
  const navigate = useNavigate();

  // Tap-vs-drag guard (a release must never navigate) + MTS gesture state + grid rect.
  const movedRef = useRef(false);
  const gestureRef = useMainThreadRef<WeekDragState>({ ...INITIAL_WEEK_DRAG });
  const gridRectRef = useMainThreadRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Plain background helpers referenced from the worklets via runOnBackground (which must be CALLED
  // on the main thread, i.e. inside a worklet -- never during render). Commit: start_min always;
  // due_date only when the day changed.
  const commitWeek = (id: string, fromDay: string, col: number, min: number) => {
    const newDay = days[col];
    mutate({
      id,
      patch: { start_min: min, ...(newDay !== fromDay ? { due_date: toPbDate(newDay) } : {}) },
    });
  };
  const flagMoved = () => {
    movedRef.current = true;
  };
  const clearMoved = () => {
    movedRef.current = false;
  };

  // Grid rect: background boundingClientRect -> MainThreadRef (SPEC 5). applyRect is a main-thread
  // function; measureGrid runs on the background thread and hands the rect over via runOnMainThread.
  function applyRect(left: number, top: number, width: number, height: number) {
    "main thread";
    gridRectRef.current = { left, top, width, height };
  }
  const measureGrid = () => {
    lynx
      .createSelectorQuery()
      .select("#week-grid")
      .invoke({
        method: "boundingClientRect",
        params: { relativeTo: "screen" },
        success: (r: { left: number; top: number; width: number; height: number }) => {
          void runOnMainThread(applyRect)(r.left, r.top, r.width, r.height);
        },
      })
      .exec();
  };
  useEffect(() => {
    measureGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure on mount + when the zoom or week changes
  }, [pxPerMin, days]);

  function onBlockStart(e: MainThread.TouchEvent) {
    "main thread";
    const t = e.touches[0];
    const px = Number(e.currentTarget.getAttribute("data-px")) || 1;
    gestureRef.current = {
      mode: "move",
      startX: t.clientX,
      startY: t.clientY,
      px,
      col: -1,
      min: 0,
      off: true,
      moved: false,
    };
    e.currentTarget.setStyleProperty("z-index", "30");
    e.currentTarget.setStyleProperty("box-shadow", "0 6px 18px -6px rgb(40 32 24 / 0.35)");
    runOnBackground(clearMoved)();
    runOnBackground(measureGrid)(); // refresh the grid rect for this gesture (one-frame delay is fine)
  }
  function onBlockMove(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "move") return;
    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;
    if (!g.moved && (dx > 4 || dx < -4 || dy > 4 || dy < -4)) {
      g.moved = true;
      runOnBackground(flagMoved)();
    }
    e.currentTarget.setStyleProperty("transform", `translate(${dx}px, ${dy}px) scale(1.04) rotate(-0.6deg)`);
    const r = gridRectRef.current;
    const usableLeft = r.left + GUTTER;
    const usableWidth = r.width - GUTTER;
    const localY = t.y - r.top;
    let col = Math.floor(((t.x - usableLeft) / usableWidth) * 7);
    col = Math.min(6, Math.max(0, col));
    let min = Math.round((DAY_START + localY / g.px) / SNAP) * SNAP;
    min = Math.min(DAY_END - SNAP, Math.max(DAY_START, min));
    const inGrid =
      r.width > 0 && t.x - r.left >= 0 && t.x - r.left <= r.width && localY >= -10 && localY <= r.height + 10;
    g.col = col;
    g.min = min;
    g.off = !inGrid;
  }
  function onBlockEnd(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "move") return;
    e.currentTarget.setStyleProperty("transform", "");
    e.currentTarget.setStyleProperty("z-index", "");
    e.currentTarget.setStyleProperty("box-shadow", "");
    const id = e.currentTarget.getAttribute("data-id");
    const fromDay = e.currentTarget.getAttribute("data-day");
    const col = g.col;
    const min = g.min;
    const inGrid = !g.off;
    const moved = g.moved;
    g.mode = "";
    if (moved && inGrid && id && fromDay && col >= 0) runOnBackground(commitWeek)(id, fromDay, col, min);
  }

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
  // gives pixels from the column top (= the hour-area top). Mirrors TimeboxSheet's addAt (unit 4.3).
  const addAt = (e: { changedTouches?: { y: number }[]; detail?: { y: number } }) => {
    if (!onAddSlot) return;
    const y = e.changedTouches?.[0]?.y ?? e.detail?.y;
    const minute =
      y != null
        ? Math.min(DAY_END - SNAP, Math.max(DAY_START, Math.round((DAY_START + y / pxPerMin) / SNAP) * SNAP))
        : DAY_START;
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
      {scheduled.map((t) => {
        const lane = lanes.get(t.id) ?? SOLO_LANE;
        const height = t.dur_min * pxPerMin;
        const top = (t.start_min - DAY_START) * pxPerMin;
        return (
          // WeekBlock inlined (SPEC 5): the MTS cross-day drag worklets bind to same-scope
          // identifiers. Markup unchanged from the 5.1 static block + the drag handlers.
          <view
            key={t.id}
            main-thread:bindtouchstart={onBlockStart}
            main-thread:bindtouchmove={onBlockMove}
            main-thread:bindtouchend={onBlockEnd}
            main-thread:bindtouchcancel={onBlockEnd}
            bindtap={() => {
              if (movedRef.current) {
                movedRef.current = false;
                return;
              }
              void navigate({ to: "/task/$id", params: { id: t.id } });
            }}
            data-id={t.id}
            data-px={pxPerMin}
            accessibility-label={t.title}
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
              <text className="truncate text-[10px] font-medium leading-tight text-ink">{t.title}</text>
              {height >= 34 && (
                <text className="text-[9px] tabular-nums leading-tight text-ink-muted">
                  {fmtMin(t.start_min)}
                </text>
              )}
            </view>
          </view>
        );
      })}
      {sessions.map((s) => (
        <WeekSessionBlock key={s.id} ext={s} lane={lanes.get(s.id) ?? SOLO_LANE} />
      ))}
    </view>
  );
}

/** A timeboxed learning session in the week spread (INERT seam for unit 5.3; never instantiated at
 * L5 since externsByDay is empty). Read-only -- it links to its page, no drag. */
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
