// The timeboxed day sheet (unit 4.3 static shell -> unit 5.2 gesture layer, ruling R3). Ruled hours
// with a now-thread, statically-positioned blocks (from start_min/dur_min via layoutLanes), the "on
// the shelf" list as chips, and a tap-empty-hour overlay that opens the composer. This unit adds the
// Main-Thread Scripting (MTS) gestures the 4.3 shell deferred:
//   - TimeBlock MOVE (drag up/down to reslot, 15-min snap) + drag-off-the-top to unschedule;
//   - the hem RESIZE (pull the bottom edge to restretch the block);
//   - ShelfChip DROP (drag a shelf slip onto the day to give it a time).
//
// PORTED FROM (recorded BROOM, src-legacy already git-rm'd by 4.3): the `motion` `drag`/`whileDrag`/
// `previewFromOffset` block move, the pointer-capture `onPointer*` hem resize, and the `motion` drag
// ShelfChip + its `minuteAtPoint`/`getBoundingClientRect`/`window.scroll` math. Re-authored as Lynx
// MTS: `main-thread:bindtouch*` worklets that read `event.touches[0]` and write style via
// `event.currentTarget.setStyleProperty`, holding per-gesture state in a `useMainThreadRef`, and
// committing the final position to PocketBase on release via `runOnBackground` (SPEC steps 1-8).
//
// GESTURE ARCHITECTURE (see the framework crib + SPEC): the worklets, their MainThreadRefs and the
// draggable elements all live in THIS one component (the proven Phase-0 spike pattern -- a worklet
// captures only same-scope MainThreadRefs and same-module constants; it CANNOT call outer helpers
// like snap()/clamp() (spike finding 4), so that arithmetic is inlined). The old TimeBlock/ShelfChip
// sub-components are therefore inlined into the render (markup unchanged) so the handlers bind to a
// same-scope worklet identifier (like the 4.3 press helper does). Per-block values (id/start/dur and
// the live px-per-min) ride as `data-*` attributes the worklet reads off `e.currentTarget` -- NOT
// closure captures (crib: captured vars must be JSON-serializable). MOVE/RESIZE are pure clientY
// DELTAS (no measurement); the ShelfChip DROP needs the grid rectangle, measured on the BACKGROUND
// thread via `lynx.createSelectorQuery().select('#timebox-grid').invoke({method:'boundingClientRect'})`
// (the callback form is the background NodesRef API; the story's main-thread `.invoke().exec()` was a
// conflation -- MainThread.Element.invoke is Promise-based and cannot resolve inside a worklet, which
// forbids nested defs) and mirrored into a MainThreadRef via `runOnMainThread`, measured at mount +
// on zoom + refreshed at drag-start (story SPEC 5 sanctioned "measure at mount / refresh"). On the
// web target both `touches[0].x/y` and boundingClientRect are LynxView-local, so grid-relative math
// subtracts rect.left/top directly (the old window.scroll offsets are dropped). Native coordinate
// semantics for the drop gestures are PARKED (this box has no device).
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { runOnBackground, runOnMainThread, useMainThreadRef } from "@lynx-js/react";
import type { MainThread } from "@lynx-js/types";

import { Check } from "@/components/page/Check";
import { Eyebrow, Panel } from "@/components/surface";
import { cn } from "@/lib/cn";
import type { AgendaExternal } from "../types";
import { localDate, useDayTasks, useUpdateTask } from "../api";
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
import { SheetHeading } from "./AgendaSheet";
import { BINDING_ROW, BINDING_SLOT, RING_COUNT } from "./PlannerBook";

/** Per-gesture state, held in a useMainThreadRef (plain JSON-serializable object, SPEC 1). One
 * gesture at a time, so a single ref serves block-move, hem-resize and shelf-drop; `mode` tells the
 * bubbling parent handler to stand down (mirrors the old e.stopPropagation on the hem). */
interface DragState {
  mode: "" | "move" | "resize" | "shelf";
  startY: number;
  startX: number;
  baseStartMin: number;
  baseDur: number;
  px: number;
  start: number;
  dur: number;
  off: boolean;
  moved: boolean;
}

const INITIAL_DRAG: DragState = {
  mode: "",
  startY: 0,
  startX: 0,
  baseStartMin: 0,
  baseDur: 60,
  px: 1,
  start: 0,
  dur: 60,
  off: false,
  moved: false,
};

/** A time-boxable item - a task or a learning session - flattened for the grid. */
interface Boxed {
  key: string;
  title: string;
  startMin: number;
  durMin: number;
  gate?: boolean;
  accentClass?: string;
  to: string;
  params: Record<string, string>;
  onToggleDone: () => void;
}

const SOLO_LANE = { lane: 0, lanes: 1 };
const NO_EXTERN: AgendaExternal[] = [];

export function TimeboxSheet({
  date,
  extern = NO_EXTERN,
  onAddSlot,
}: {
  date: string;
  extern?: AgendaExternal[];
  onAddSlot?: (date: string, startMin: number) => void;
}) {
  const { data: tasks, isPending, error } = useDayTasks(date);
  const update = useUpdateTask();
  const mutate = update.mutate;
  const pxPerMin = usePxPerMin();
  const navigate = useNavigate();

  // Tap-vs-drag guard (SPEC 6): a background flag the block's bindtap consumes, set from the drag
  // worklet via runOnBackground. Replaces the old `dragging` ref + onClickCapture preventDefault.
  const movedRef = useRef(false);

  // MTS gesture state + element handles (accessed only inside 'main thread' worklets).
  const gestureRef = useMainThreadRef<DragState>({ ...INITIAL_DRAG });
  const ghostRef = useMainThreadRef<MainThread.Element>(null);
  const gridRectRef = useMainThreadRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // ── plain background helpers referenced from the worklets via runOnBackground (which must be
  //    CALLED on the main thread, i.e. inside a worklet -- never during render, or the web reconciler
  //    aborts the element tree). useUpdateTask().mutate is optimistic and persists start_min/dur_min. ──
  const commitMove = (id: string, off: boolean, start: number, base: number) => {
    if (off) mutate({ id, patch: { start_min: 0 } });
    else if (start !== base) mutate({ id, patch: { start_min: start } });
  };
  const commitResize = (id: string, dur: number) => mutate({ id, patch: { dur_min: dur } });
  const commitSchedule = (id: string, start: number) => mutate({ id, patch: { start_min: start } });
  const flagMoved = () => {
    movedRef.current = true;
  };
  const clearMoved = () => {
    movedRef.current = false;
  };

  // ── grid measurement: background boundingClientRect -> MainThreadRef (SPEC 5). applyRect is a
  //    main-thread function; measureGrid runs on the background thread and hands the rect over. ──
  function applyRect(left: number, top: number, width: number, height: number) {
    "main thread";
    gridRectRef.current = { left, top, width, height };
  }
  const measureGrid = () => {
    lynx
      .createSelectorQuery()
      .select("#timebox-grid")
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure on mount + when the zoom or day changes
  }, [pxPerMin, date]);

  // ── MOVE worklets (block body). Delta on clientY; drives the block transform + the ghost slot. ──
  function onBlockStart(e: MainThread.TouchEvent) {
    "main thread";
    if (gestureRef.current.mode === "resize") return; // the hem owns this gesture
    const t = e.touches[0];
    const px = Number(e.currentTarget.getAttribute("data-px")) || 1;
    const base = Number(e.currentTarget.getAttribute("data-start")) || 0;
    const dur = Number(e.currentTarget.getAttribute("data-dur")) || 60;
    gestureRef.current = {
      mode: "move",
      startY: t.clientY,
      startX: t.clientX,
      baseStartMin: base,
      baseDur: dur,
      px,
      start: base,
      dur,
      off: false,
      moved: false,
    };
    e.currentTarget.setStyleProperty("z-index", "30");
    e.currentTarget.setStyleProperty("box-shadow", "0 6px 18px -6px rgb(40 32 24 / 0.35)");
    runOnBackground(clearMoved)();
  }
  function onBlockMove(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "move") return;
    const t = e.touches[0];
    const dy = t.clientY - g.startY;
    if (!g.moved && (dy > 4 || dy < -4)) {
      g.moved = true;
      runOnBackground(flagMoved)();
    }
    e.currentTarget.setStyleProperty("transform", `translateY(${dy}px) scale(1.02) rotate(-0.4deg)`);
    const raw = g.baseStartMin + dy / g.px;
    let start = Math.round(raw / SNAP) * SNAP;
    start = Math.min(DAY_END - SNAP, Math.max(DAY_START, start));
    const off = raw < DAY_START - 20;
    g.start = start;
    g.off = off;
    e.currentTarget.setStyleProperty("opacity", off ? "0.5" : "1");
    e.currentTarget.setStyleProperty("filter", off ? "saturate(0.5)" : "none");
    const ghost = ghostRef.current;
    if (ghost) {
      if (off) ghost.setStyleProperty("opacity", "0");
      else
        ghost.setStyleProperties({
          transform: `translateY(${(start - DAY_START) * g.px}px)`,
          height: `${g.baseDur * g.px}px`,
          opacity: "1",
        });
    }
  }
  function onBlockEnd(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "move") return;
    e.currentTarget.setStyleProperty("transform", "");
    e.currentTarget.setStyleProperty("z-index", "");
    e.currentTarget.setStyleProperty("box-shadow", "");
    e.currentTarget.setStyleProperty("opacity", "");
    e.currentTarget.setStyleProperty("filter", "");
    const ghost = ghostRef.current;
    if (ghost) ghost.setStyleProperty("opacity", "0");
    const id = e.currentTarget.getAttribute("data-id");
    const moved = g.moved;
    const off = g.off;
    const start = g.start;
    const base = g.baseStartMin;
    g.mode = "";
    if (moved && id) runOnBackground(commitMove)(id, off, start, base);
  }

  // ── RESIZE worklets (the hem <view>). Delta on clientY -> dur; drives the ghost height; stops the
  //    gesture from bubbling into the block MOVE (stopPropagation + the mode guard). ──
  function onHemStart(e: MainThread.TouchEvent) {
    "main thread";
    e.stopPropagation();
    const t = e.touches[0];
    const px = Number(e.currentTarget.getAttribute("data-px")) || 1;
    const base = Number(e.currentTarget.getAttribute("data-start")) || 0;
    const dur = Number(e.currentTarget.getAttribute("data-dur")) || 60;
    gestureRef.current = {
      mode: "resize",
      startY: t.clientY,
      startX: t.clientX,
      baseStartMin: base,
      baseDur: dur,
      px,
      start: base,
      dur,
      off: false,
      moved: false,
    };
  }
  function onHemMove(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "resize") return;
    e.stopPropagation();
    const t = e.touches[0];
    let dur = Math.round((g.baseDur + (t.clientY - g.startY) / g.px) / SNAP) * SNAP;
    dur = Math.min(DAY_END - g.baseStartMin, Math.max(SNAP, dur));
    g.dur = dur;
    const ghost = ghostRef.current;
    if (ghost)
      ghost.setStyleProperties({
        transform: `translateY(${(g.baseStartMin - DAY_START) * g.px}px)`,
        height: `${dur * g.px}px`,
        opacity: "1",
      });
  }
  function onHemEnd(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "resize") return;
    e.stopPropagation();
    const ghost = ghostRef.current;
    if (ghost) ghost.setStyleProperty("opacity", "0");
    const id = e.currentTarget.getAttribute("data-id");
    const dur = g.dur;
    const baseDur = g.baseDur;
    g.mode = "";
    if (id && dur !== baseDur) runOnBackground(commitResize)(id, dur);
  }

  // ── SHELF-DROP worklets (a shelf chip). Absolute: needs the grid rect. Chip follows the finger;
  //    on release, a point inside the grid schedules it to that minute (SPEC 5). ──
  function onShelfStart(e: MainThread.TouchEvent) {
    "main thread";
    const t = e.touches[0];
    const px = Number(e.currentTarget.getAttribute("data-px")) || 1;
    const dur = Number(e.currentTarget.getAttribute("data-dur")) || 60;
    gestureRef.current = {
      mode: "shelf",
      startY: t.clientY,
      startX: t.clientX,
      baseStartMin: 0,
      baseDur: dur,
      px,
      start: 0,
      dur,
      off: true,
      moved: false,
    };
    e.currentTarget.setStyleProperty("z-index", "40");
    runOnBackground(measureGrid)(); // refresh the grid rect for this gesture (one-frame delay is fine)
  }
  function onShelfMove(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "shelf") return;
    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;
    if (!g.moved && (dx > 4 || dx < -4 || dy > 4 || dy < -4)) g.moved = true;
    e.currentTarget.setStyleProperty("transform", `translate(${dx}px, ${dy}px) scale(1.06) rotate(-1.5deg)`);
    const r = gridRectRef.current;
    const localX = t.x - r.left;
    const localY = t.y - r.top;
    const inGrid =
      r.width > 0 && localX >= 0 && localX <= r.width && localY >= -10 && localY <= r.height + 10;
    let min = Math.round((DAY_START + localY / g.px) / SNAP) * SNAP;
    min = Math.min(DAY_END - SNAP, Math.max(DAY_START, min));
    g.start = min;
    g.off = !inGrid;
    const ghost = ghostRef.current;
    if (ghost) {
      if (inGrid)
        ghost.setStyleProperties({
          transform: `translateY(${(min - DAY_START) * g.px}px)`,
          height: `${g.baseDur * g.px}px`,
          opacity: "1",
        });
      else ghost.setStyleProperty("opacity", "0");
    }
  }
  function onShelfEnd(e: MainThread.TouchEvent) {
    "main thread";
    const g = gestureRef.current;
    if (g.mode !== "shelf") return;
    e.currentTarget.setStyleProperty("transform", "");
    e.currentTarget.setStyleProperty("z-index", "");
    const ghost = ghostRef.current;
    if (ghost) ghost.setStyleProperty("opacity", "0");
    const id = e.currentTarget.getAttribute("data-id");
    const min = g.start;
    const inGrid = !g.off;
    g.mode = "";
    if (id && g.moved && inGrid) runOnBackground(commitSchedule)(id, min);
  }

  const boxed = useMemo<Boxed[]>(() => {
    const fromTasks = (tasks ?? [])
      .filter((t) => !t.done_at)
      .map(
        (t): Boxed => ({
          key: t.id,
          title: t.title,
          startMin: t.start_min,
          durMin: t.dur_min,
          to: "/task/$id",
          params: { id: t.id },
          onToggleDone: () => mutate({ id: t.id, patch: { done_at: new Date().toISOString() } }),
        }),
      );
    const fromSessions = extern
      .filter((e) => !e.done && e.onSchedule)
      .map(
        (e): Boxed => ({
          key: e.id,
          title: e.title,
          gate: e.gate,
          accentClass: e.accentClass,
          startMin: e.startMin ?? 0,
          durMin: e.durMin ?? 60,
          to: e.to,
          params: e.params,
          onToggleDone: e.onToggle,
        }),
      );
    return [...fromTasks, ...fromSessions];
  }, [tasks, extern, mutate]);

  const scheduled = boxed.filter((b) => b.startMin > 0);
  const shelf = boxed.filter((b) => b.startMin <= 0);
  const lanes = useMemo(
    () => layoutLanes(scheduled.map((b) => ({ id: b.key, start_min: b.startMin, dur_min: b.durMin }))),
    [boxed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Empty-hour TAP -> open the composer. Coarse minute from the element-relative touch Y when the
  // web host provides it; the drag gestures own the precise coordinate math above.
  const addAt = (e: { changedTouches?: { y: number }[]; detail?: { y: number } }) => {
    if (!onAddSlot) return;
    const y = e.changedTouches?.[0]?.y ?? e.detail?.y;
    const minute =
      y != null ? clamp(snap(DAY_START + y / pxPerMin), DAY_START, DAY_END - SNAP) : DAY_START;
    onAddSlot(date, minute);
  };

  return (
    <Panel className="p-5 pt-9 md:p-7 md:pt-10" data-testid="timebox-sheet">
      <view aria-hidden className={`${BINDING_ROW} pointer-events-none top-[9px]`}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <view key={i} className={BINDING_SLOT}>
            <view className="inset-well h-2.5 w-2.5 rounded-full bg-gradient-to-b from-ink/25 to-ink/10" />
          </view>
        ))}
      </view>

      <SheetHeading date={date} count={boxed.length} />

      {error && (
        <view className="mt-3 rounded-xl border border-clay/40 bg-clay/10 p-3">
          <text className="text-sm text-ink">Couldn't load this day. </text>
          <text className="font-mono text-xs text-ink-muted">{error.message}</text>
        </view>
      )}
      {isPending && !error && (
        <view className="mt-4 h-40 animate-pulse rounded-xl bg-ink/[0.04]" aria-hidden />
      )}

      {tasks && (
        <>
          {shelf.length > 0 && (
            <view className="mt-4">
              <Eyebrow>on the shelf</Eyebrow>
              <view className="mt-2 flex flex-wrap gap-2">
                {shelf.map((b) => (
                  // ShelfChip inlined (SPEC 5): the MTS drop worklets must bind to a same-scope
                  // worklet identifier. Markup unchanged from the 4.3 chip + drag handlers.
                  <view
                    key={b.key}
                    main-thread:bindtouchstart={onShelfStart}
                    main-thread:bindtouchmove={onShelfMove}
                    main-thread:bindtouchend={onShelfEnd}
                    main-thread:bindtouchcancel={onShelfEnd}
                    data-id={b.key}
                    data-dur={b.durMin}
                    data-px={pxPerMin}
                    data-testid="timebox-shelf-chip"
                    className="grain flex items-center gap-2 rounded-full border border-rule/70 bg-surface py-1.5 pl-2 pr-3.5 shadow-soft"
                  >
                    <Check
                      done={false}
                      gate={b.gate}
                      label={`Mark "${b.title}" done`}
                      className="h-[18px] w-[18px]"
                      onToggle={b.onToggleDone}
                    />
                    {b.accentClass && (
                      <view className={cn("h-2 w-2 shrink-0 rounded-full", b.accentClass)} aria-hidden />
                    )}
                    <text className="max-w-44 truncate text-[13px] font-medium text-ink">
                      {b.gate ? "⛳ " : ""}
                      {b.title}
                    </text>
                  </view>
                ))}
              </view>
              <text className="mt-2 block text-[11px] text-ink-muted/80">
                Drag a slip onto the day below to give it a time.
              </text>
            </view>
          )}

          <view className="mt-5">
            <HourRules date={date} gridId="timebox-grid">
              {/* Empty hours are tappable - a tap opens the composer at that time. Sits under the
                  blocks, so tapping a block never fires it. */}
              {onAddSlot && (
                <view
                  bindtap={addAt}
                  accessibility-label="Add a task at this time"
                  accessibility-traits="button"
                  data-testid="timebox-add-slot"
                  className="absolute inset-0 z-0"
                />
              )}
              {/* The live drag/resize ghost: always mounted (opacity 0 at rest) so the worklets can
                  drive its position/height/visibility via setStyleProperties (SPEC 2/5). The old
                  floating time-label pill is dropped: MTS cannot update <text> content mid-gesture
                  without a background re-render, which would clobber the main-thread drag transform;
                  the block's own moving position conveys the target time. */}
              <view
                main-thread:ref={ghostRef}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 rounded-xl border-2 border-dashed border-zest/50 bg-zest/[0.06] opacity-0"
                style={{ top: 0, height: 0 }}
              />
              {scheduled.map((b) => {
                const lane = lanes.get(b.key) ?? SOLO_LANE;
                const height = b.durMin * pxPerMin;
                const compact = height < 46;
                return (
                  // TimeBlock inlined (SPEC 2): same markup as the 4.3 static block + the MTS move
                  // handlers on the body and the resize handlers on the re-added hem.
                  <view
                    key={b.key}
                    main-thread:bindtouchstart={onBlockStart}
                    main-thread:bindtouchmove={onBlockMove}
                    main-thread:bindtouchend={onBlockEnd}
                    main-thread:bindtouchcancel={onBlockEnd}
                    data-id={b.key}
                    data-start={b.startMin}
                    data-dur={b.durMin}
                    data-px={pxPerMin}
                    data-testid="timebox-block"
                    data-top={String(Math.round((b.startMin - DAY_START) * pxPerMin))}
                    className="grain absolute overflow-hidden rounded-xl border border-rule/70 bg-surface shadow-soft"
                    style={{
                      top: (b.startMin - DAY_START) * pxPerMin,
                      height,
                      left: `${(lane.lane / lane.lanes) * 100}%`,
                      width: `calc(${100 / lane.lanes}% - 4px)`,
                      marginLeft: 2,
                    }}
                  >
                    <view
                      className={cn(
                        "absolute inset-y-1 left-1 w-[3px] rounded-full",
                        b.accentClass ?? "bg-zest/70",
                      )}
                      aria-hidden
                    />
                    <view
                      className={cn("flex h-full gap-2 pl-3 pr-2", compact ? "items-center py-0.5" : "py-1.5")}
                    >
                      <Check
                        done={false}
                        gate={b.gate}
                        label={`Mark "${b.title}" done`}
                        className="mt-px h-[18px] w-[18px] shrink-0"
                        onToggle={b.onToggleDone}
                      />
                      <view
                        bindtap={() => {
                          // Consume a just-completed drag so a release never navigates (SPEC 6).
                          if (movedRef.current) {
                            movedRef.current = false;
                            return;
                          }
                          void navigate({ to: b.to, params: b.params } as never);
                        }}
                        accessibility-traits="button"
                        className="min-w-0 flex-1 active:opacity-70"
                      >
                        <text
                          className={cn("truncate font-medium text-ink", compact ? "text-xs" : "text-[13px]")}
                        >
                          {b.gate ? "⛳ " : ""}
                          {b.title}
                        </text>
                        {!compact && (
                          <text className="text-[10px] tabular-nums text-ink-muted">
                            {fmtMin(b.startMin)} - {fmtMin(b.startMin + b.durMin)}
                          </text>
                        )}
                      </view>
                    </view>

                    {/* The hem: pull to restretch the slot. Its own MTS handlers set mode='resize'
                        so the bubbling block MOVE stands down (SPEC 3). */}
                    <view
                      main-thread:bindtouchstart={onHemStart}
                      main-thread:bindtouchmove={onHemMove}
                      main-thread:bindtouchend={onHemEnd}
                      main-thread:bindtouchcancel={onHemEnd}
                      data-id={b.key}
                      data-start={b.startMin}
                      data-dur={b.durMin}
                      data-px={pxPerMin}
                      accessibility-label={`Resize "${b.title}"`}
                      data-testid="timebox-hem"
                      className="absolute inset-x-0 bottom-0 flex h-3.5 items-end justify-center pb-1 opacity-60"
                    >
                      <view className="h-[3px] w-7 rounded-full bg-ink/15" />
                    </view>
                  </view>
                );
              })}
            </HourRules>
            {scheduled.length === 0 && (
              <text className="pointer-events-none mt-3 block px-2 text-center text-sm text-ink-muted">
                {shelf.length > 0
                  ? "Tap an hour to add, or drag a slip down from the shelf."
                  : "Tap any hour to box in a task."}
              </text>
            )}
          </view>
        </>
      )}
    </Panel>
  );
}

/** The ruled hours: printed labels in the margin, hairline rules across, a zest "now" thread. The
 * outer <view> carries `gridId` so the drag worklets can measure it by id (background selector
 * query, SPEC 5); the day sheet and the week spread pass distinct ids. */
export function HourRules({
  date,
  gridId,
  children,
}: {
  date: string;
  gridId?: string;
  children: React.ReactNode;
}) {
  const nowMin = useNowMinutes(date === localDate());
  const pxPerMin = usePxPerMin();

  return (
    <view id={gridId} className="relative" style={{ height: (DAY_END - DAY_START) * pxPerMin }}>
      <HourGrid pxPerMin={pxPerMin} nowMin={nowMin} />
      <view className="absolute inset-y-0 right-0" style={{ left: GUTTER }}>
        {children}
      </view>
    </view>
  );
}

/** The static ruled hours (labels, rules, now-thread). */
function HourGrid({ pxPerMin, nowMin }: { pxPerMin: number; nowMin: number | null }) {
  const showHalf = pxPerMin >= 0.75;
  const showQuarter = pxPerMin >= 1.05;
  const ticks = Array.from(
    { length: (DAY_END - DAY_START) / SNAP + 1 },
    (_, i) => DAY_START + i * SNAP,
  );

  return (
    <>
      {ticks.map((m) => {
        const inHour = (m - DAY_START) % 60;
        const isHour = inHour === 0;
        const isHalf = inHour === 30;
        if (!isHour && !isHalf && !showQuarter) return null;
        if (isHalf && !showHalf) return null;
        return (
          <view key={m} className="absolute inset-x-0" style={{ top: (m - DAY_START) * pxPerMin }}>
            <text
              className={cn(
                "absolute left-0 w-9 text-right tabular-nums",
                isHour
                  ? "-top-[5px] text-[9px] font-medium uppercase text-ink-muted/70"
                  : "-top-[4px] text-[8px] text-ink-muted/40",
              )}
            >
              {isHour ? fmtMin(m) : showQuarter || isHalf ? `:${inHour}` : ""}
            </text>
            <view
              className={cn(
                "border-t",
                isHour ? "border-rule/60" : isHalf ? "border-rule/35" : "border-rule/20",
              )}
              style={{ marginLeft: GUTTER }}
            />
          </view>
        );
      })}

      {nowMin != null && nowMin >= DAY_START && nowMin <= DAY_END && (
        <view
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: (nowMin - DAY_START) * pxPerMin }}
        >
          <view
            className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-zest shadow-soft"
            style={{ left: GUTTER - 3 }}
          />
          <view className="border-t-2 border-zest/70" style={{ marginLeft: GUTTER + 3 }} />
        </view>
      )}
    </>
  );
}

function useNowMinutes(enabled: boolean): number | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);
  return enabled ? now.getHours() * 60 + now.getMinutes() : null;
}
