// The timeboxed day sheet - STATIC SHELL (unit 4.3, ported from src-legacy/features/tasks/
// components/TimeboxSheet.tsx onto Lynx). Ruled hours with a now-thread, statically-positioned
// blocks (from start_min/dur_min via layoutLanes), the "on the shelf" list as static chips, and a
// tap-empty-hour overlay that opens the composer. check-off (tap) and open-on-tap stay.
//
// NOT MOUNTED IN L4: `TimeboxSheet` is consumed by `Calendar` (unit 5.1) and wired there; its @l4
// coverage is limited to build/typecheck + this static render (it is not on a mounted L4 route).
//
// DROPPED to unit 5.2 (the MTS gesture unit, ruling R3): the `TimeBlock` `drag`/`onDrag`/
// `onDragEnd`/`whileDrag`/`previewFromOffset` block-move gesture; the hem `onPointerDown/Move/Up/
// Cancel` resize; the `ShelfChip` `drag`/`onDragEnd` + `minuteAtPoint`/`minuteFromClientY`
// DOM-rect math (`getBoundingClientRect`/`window.scrollY` are drag-only and R11-forbidden on the
// web worker anyway). The ghost-slot render is kept but its state is inert here (5.2 turns the
// `ghost` read into read+write). The precise tap-Y -> minute mapping the empty-hour overlay wants
// is part of that dropped coordinate math; here the overlay stays a real TAP that opens the
// composer near the tapped time (element-relative touch Y when present, else the day start), with
// the exact snap deferred to 5.2.
//
// DROPPED (recorded BROOM): `motion`/`AnimatePresence` -> static render + the L2 CSS enter where
// wanted; `lucide-react` (`ArrowUpFromLine`) was ONLY the drag "off-sheet" indicator, so it is not
// imported here - it returns with the 5.2 drag. `Link` -> `<view bindtap>` navigate.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

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

/** Live drag/resize preview slot (5.2 drives it; inert here). */
type Ghost = { id: string; start: number; dur: number; off?: boolean };

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
  // Inert until 5.2 (which adds the setter + drives it from the drag gesture).
  const [ghost] = useState<Ghost | null>(null);

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
  // web host provides it; precise snap is 5.2's (the DOM-rect math was dropped there).
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
                  <ShelfChip key={b.key} item={b} />
                ))}
              </view>
              <text className="mt-2 block text-[11px] text-ink-muted/80">
                Drag a slip onto the day below to give it a time.
              </text>
            </view>
          )}

          <view className="mt-5">
            <HourRules date={date}>
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
              {ghost && !ghost.off && (
                <view
                  className="pointer-events-none absolute inset-x-0 rounded-xl border-2 border-dashed border-zest/50 bg-zest/[0.06]"
                  style={{
                    top: (ghost.start - DAY_START) * pxPerMin,
                    height: ghost.dur * pxPerMin,
                  }}
                >
                  <view className="absolute -top-2.5 right-2 rounded-full border border-zest/40 bg-surface px-2 py-0.5 shadow-soft">
                    <text className="text-[10px] font-medium tabular-nums text-zest">
                      {fmtMin(ghost.start)} - {fmtMin(ghost.start + ghost.dur)}
                    </text>
                  </view>
                </view>
              )}
              {scheduled.map((b) => (
                <TimeBlock key={b.key} item={b} lane={lanes.get(b.key) ?? SOLO_LANE} />
              ))}
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

/** The ruled hours: printed labels in the margin, hairline rules across, a zest "now" thread. */
export function HourRules({ date, children }: { date: string; children: React.ReactNode }) {
  const nowMin = useNowMinutes(date === localDate());
  const pxPerMin = usePxPerMin();

  return (
    <view className="relative" style={{ height: (DAY_END - DAY_START) * pxPerMin }}>
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

/** One boxed task: a grained paper slip pinned to its slot (static; drag/resize = 5.2). */
function TimeBlock({ item, lane }: { item: Boxed; lane: { lane: number; lanes: number } }) {
  const navigate = useNavigate();
  const pxPerMin = usePxPerMin();
  const height = item.durMin * pxPerMin;
  const compact = height < 46;

  return (
    <view
      className="grain absolute overflow-hidden rounded-xl border border-rule/70 bg-surface shadow-soft"
      style={{
        top: (item.startMin - DAY_START) * pxPerMin,
        height,
        left: `${(lane.lane / lane.lanes) * 100}%`,
        width: `calc(${100 / lane.lanes}% - 4px)`,
        marginLeft: 2,
      }}
    >
      <view
        className={cn("absolute inset-y-1 left-1 w-[3px] rounded-full", item.accentClass ?? "bg-zest/70")}
        aria-hidden
      />
      <view className={cn("flex h-full gap-2 pl-3 pr-2", compact ? "items-center py-0.5" : "py-1.5")}>
        <Check
          done={false}
          gate={item.gate}
          label={`Mark "${item.title}" done`}
          className="mt-px h-[18px] w-[18px] shrink-0"
          onToggle={item.onToggleDone}
        />
        <view
          bindtap={() => void navigate({ to: item.to, params: item.params } as never)}
          accessibility-traits="button"
          className="min-w-0 flex-1 active:opacity-70"
        >
          <text className={cn("truncate font-medium text-ink", compact ? "text-xs" : "text-[13px]")}>
            {item.gate ? "⛳ " : ""}
            {item.title}
          </text>
          {!compact && (
            <text className="text-[10px] tabular-nums text-ink-muted">
              {fmtMin(item.startMin)} - {fmtMin(item.startMin + item.durMin)}
            </text>
          )}
        </view>
      </view>
    </view>
  );
}

/** An unscheduled item waiting on the shelf (static; drag-to-schedule = 5.2). */
function ShelfChip({ item }: { item: Boxed }) {
  return (
    <view className="grain flex items-center gap-2 rounded-full border border-rule/70 bg-surface py-1.5 pl-2 pr-3.5 shadow-soft">
      <Check
        done={false}
        gate={item.gate}
        label={`Mark "${item.title}" done`}
        className="h-[18px] w-[18px]"
        onToggle={item.onToggleDone}
      />
      {item.accentClass && (
        <view className={cn("h-2 w-2 shrink-0 rounded-full", item.accentClass)} aria-hidden />
      )}
      <text className="max-w-44 truncate text-[13px] font-medium text-ink">
        {item.gate ? "⛳ " : ""}
        {item.title}
      </text>
    </view>
  );
}
