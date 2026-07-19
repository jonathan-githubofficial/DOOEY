import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpFromLine } from "lucide-react";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel } from "@/components/surface";
import { Check } from "@/components/page/Check";
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

/** The day as a ruled sheet of hours. Blocks are paper slips: drag to move
 * (15-min snap), pull the bottom edge to stretch, drag up off the sheet to
 * unschedule. Unscheduled work waits on a shelf above and drops into a slot. */

/** Live drag/resize preview: the snapped slot a gesture is heading for. */
type Ghost = { id: string; start: number; dur: number; off?: boolean };

/** A time-boxable item — a task or a learning session — with its own persist
 * handlers, so the grid treats both the same. */
interface Boxed {
  key: string;
  title: string;
  startMin: number;
  durMin: number;
  gate?: boolean;
  accentClass?: string; // category dot for sessions; tasks omit it
  to: string;
  params: Record<string, string>;
  onToggleDone: () => void;
  onSchedule: (startMin: number) => void; // shelf-drop and move both use this
  onResize: (durMin: number) => void;
  onUnschedule: () => void;
}

/** Shared identity for un-laned blocks, so its reference stays stable and
 * memoized blocks don't re-render. */
const SOLO_LANE = { lane: 0, lanes: 1 };
/** Stable default so an omitted `extern` keeps a constant reference. */
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
  const gridRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const pxPerMin = usePxPerMin();

  const mutate = update.mutate;
  // Stable handlers so memoized blocks don't re-render every drag frame.
  const schedule = useCallback(
    (id: string, startMin: number, durMin?: number) =>
      mutate({
        id,
        patch: {
          start_min: clamp(snap(startMin), DAY_START, DAY_END - SNAP),
          ...(durMin != null ? { dur_min: durMin } : {}),
        },
      }),
    [mutate],
  );
  const unschedule = useCallback((id: string) => mutate({ id, patch: { start_min: 0 } }), [mutate]);
  const resize = useCallback((id: string, dur: number) => mutate({ id, patch: { dur_min: dur } }), [mutate]);

  // Tasks and (schedulable) learning sessions share one boxed model. Memoized
  // so the block objects keep stable identity between drag frames.
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
          onSchedule: (s) => schedule(t.id, s),
          onResize: (d) => resize(t.id, d),
          onUnschedule: () => unschedule(t.id),
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
          onSchedule: e.onSchedule!,
          onResize: e.onResize!,
          onUnschedule: e.onUnschedule!,
        }),
      );
    return [...fromTasks, ...fromSessions];
  }, [tasks, extern, mutate, schedule, resize, unschedule]);

  const scheduled = boxed.filter((b) => b.startMin > 0);
  const shelf = boxed.filter((b) => b.startMin <= 0);
  const lanes = useMemo(
    () => layoutLanes(scheduled.map((b) => ({ id: b.key, start_min: b.startMin, dur_min: b.durMin }))),
    [boxed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Where a pointer (page coords) lands on the sheet, in minutes — or null. */
  const minuteAtPoint = (pageX: number, pageY: number): number | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const left = rect.left + window.scrollX;
    if (pageX < left || pageX > left + rect.width) return null;
    if (pageY < top - 10 || pageY > top + rect.height + 10) return null;
    return clamp(DAY_START + (pageY - top) / pxPerMin, DAY_START, DAY_END - SNAP);
  };

  /** Snapped minute for a click at viewport-Y on the grid. */
  const minuteFromClientY = (clientY: number): number => {
    const rect = gridRef.current!.getBoundingClientRect();
    return clamp(snap(DAY_START + (clientY - rect.top) / pxPerMin), DAY_START, DAY_END - SNAP);
  };

  return (
    <Panel className="p-5 pt-9 md:p-7 md:pt-10">
      <div aria-hidden className={`${BINDING_ROW} pointer-events-none top-[9px]`}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <span key={i} className={BINDING_SLOT}>
            <span className="inset-well h-2.5 w-2.5 rounded-full bg-gradient-to-b from-ink/25 to-ink/10" />
          </span>
        ))}
      </div>

      <SheetHeading date={date} count={boxed.length} />

      {error && (
        <p className="mt-3 rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm text-ink">
          Couldn&apos;t load this day.{" "}
          <span className="font-mono text-xs text-ink-muted">{error.message}</span>
        </p>
      )}
      {isPending && !error && (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-ink/[0.04]" aria-hidden />
      )}

      {tasks && (
        <>
          {shelf.length > 0 && (
            <div className="mt-4">
              <Eyebrow>on the shelf</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-2">
                {shelf.map((b) => (
                  <ShelfChip
                    key={b.key}
                    item={b}
                    onDropAt={(x, y) => {
                      const min = minuteAtPoint(x, y);
                      if (min != null) b.onSchedule(min);
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-ink-muted/80">
                Drag a slip onto the day below to give it a time.
              </p>
            </div>
          )}

          <div className="mt-5 select-none">
            <HourRules date={date} gridRef={gridRef}>
              {/* Empty hours are tappable — a tap opens the task drawer at that
                  time. Sits under the blocks, so tapping a block never fires it. */}
              {onAddSlot && (
                <button
                  type="button"
                  aria-label="Add a task at this time"
                  onClick={(e) => onAddSlot(date, minuteFromClientY(e.clientY))}
                  className="absolute inset-0 z-0 cursor-copy"
                />
              )}
              {ghost && !ghost.off && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pointer-events-none absolute inset-x-0 rounded-xl border-2 border-dashed border-zest/50 bg-zest/[0.06]"
                  style={{
                    top: (ghost.start - DAY_START) * pxPerMin,
                    height: ghost.dur * pxPerMin,
                  }}
                >
                  <span className="absolute -top-2.5 right-2 rounded-full border border-zest/40 bg-surface px-2 py-0.5 text-[10px] font-medium tabular-nums text-zest shadow-soft">
                    {fmtMin(ghost.start)} – {fmtMin(ghost.start + ghost.dur)}
                  </span>
                </motion.div>
              )}
              <AnimatePresence initial={false}>
                {scheduled.map((b) => (
                  <TimeBlock
                    key={b.key}
                    item={b}
                    lane={lanes.get(b.key) ?? SOLO_LANE}
                    ghost={ghost?.id === b.key ? ghost : null}
                    onGhost={setGhost}
                  />
                ))}
              </AnimatePresence>
            </HourRules>
            {scheduled.length === 0 && (
              <p className="pointer-events-none mt-3 px-2 text-center text-sm text-ink-muted">
                {shelf.length > 0
                  ? "Tap an hour to add, or drag a slip down from the shelf."
                  : "Tap any hour to box in a task."}
              </p>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

/** The ruled hours: printed labels in the margin, hairline rules across, a
 * zest "now" thread stitched through today. */
export function HourRules({
  date,
  gridRef,
  children,
}: {
  date: string;
  gridRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const nowMin = useNowMinutes(date === localDate());
  const pxPerMin = usePxPerMin();

  return (
    <div ref={gridRef} className="relative" style={{ height: (DAY_END - DAY_START) * pxPerMin }}>
      <HourGrid pxPerMin={pxPerMin} nowMin={nowMin} />
      <div className="absolute inset-y-0 right-0" style={{ left: GUTTER }}>
        {children}
      </div>
    </div>
  );
}

/** The static ruled hours (labels, rules, now-thread). Memoized so it doesn't
 * re-render on every drag frame — it only depends on the zoom and the minute. */
const HourGrid = memo(function HourGrid({
  pxPerMin,
  nowMin,
}: {
  pxPerMin: number;
  nowMin: number | null;
}) {
  // Finer rules appear as the hours grow tall enough to read them: half-hours
  // once a 30-min gap clears ~22px, quarter-hours once a 15-min gap clears ~16px.
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
          <div key={m} className="absolute inset-x-0" style={{ top: (m - DAY_START) * pxPerMin }}>
            <span
              className={cn(
                "absolute left-0 w-9 text-right tabular-nums",
                isHour
                  ? "-top-[5px] text-[9px] font-medium uppercase text-ink-muted/70"
                  : "-top-[4px] text-[8px] text-ink-muted/40",
              )}
            >
              {isHour ? fmtMin(m) : showQuarter || isHalf ? `:${inHour}` : ""}
            </span>
            <div
              className={cn(
                "border-t",
                isHour ? "border-rule/60" : isHalf ? "border-rule/35" : "border-rule/20",
              )}
              style={{ marginLeft: GUTTER }}
            />
          </div>
        );
      })}

      {nowMin != null && nowMin >= DAY_START && nowMin <= DAY_END && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10"
          style={{ top: (nowMin - DAY_START) * pxPerMin }}
        >
          <span
            className="absolute -top-[3px] h-[7px] w-[7px] rounded-full bg-zest shadow-soft"
            style={{ left: GUTTER - 3 }}
          />
          <div className="border-t-2 border-zest/70" style={{ marginLeft: GUTTER + 3 }} />
        </div>
      )}
    </>
  );
});

function useNowMinutes(enabled: boolean): number | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);
  return enabled ? now.getHours() * 60 + now.getMinutes() : null;
}

/** One boxed task: a grained paper slip pinned to its slot. Dragging lifts it
 * off the sheet and it settles onto the snapped slot; the bottom hem stretches
 * its length; hauling it up past the top sends it back to the shelf.
 *
 * Memoized with id-based callbacks: during a drag only the one block whose
 * `ghost` prop changes re-renders — the rest of the sheet stays put, which is
 * what keeps the gesture smooth. */
const TimeBlock = memo(function TimeBlock({
  item,
  lane,
  ghost,
  onGhost,
}: {
  item: Boxed;
  lane: { lane: number; lanes: number };
  ghost: Ghost | null;
  onGhost: (g: Ghost | null) => void;
}) {
  const dragging = useRef(false);
  const resize = useRef<{ pointerId: number; fromY: number; baseDur: number } | null>(null);
  const [resizeDur, setResizeDur] = useState<number | null>(null);
  const pxPerMin = usePxPerMin();

  const dur = resizeDur ?? item.durMin;
  const height = dur * pxPerMin;
  const offSheet = ghost?.off ?? false;
  const compact = height < 46;

  const previewFromOffset = (dy: number): Ghost => {
    const raw = item.startMin + dy / pxPerMin;
    return {
      id: item.key,
      start: clamp(snap(raw), DAY_START, DAY_END - SNAP),
      dur: item.durMin,
      off: raw < DAY_START - 20,
    };
  };

  return (
    <motion.div
      drag="y"
      dragMomentum={false}
      dragElastic={0.08}
      dragSnapToOrigin
      onDragStart={() => (dragging.current = true)}
      onDrag={(_e, info) => onGhost(previewFromOffset(info.offset.y))}
      onDragEnd={(_e, info) => {
        const g = previewFromOffset(info.offset.y);
        onGhost(null);
        if (g.off) item.onUnschedule();
        else if (g.start !== item.startMin) item.onSchedule(g.start);
        setTimeout(() => (dragging.current = false), 0);
      }}
      onClickCapture={(e) => {
        if (dragging.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileDrag={{
        scale: 1.02,
        rotate: -0.4,
        zIndex: 30,
        boxShadow: "0 6px 18px -6px rgb(40 32 24 / 0.35)",
      }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(
        "grain absolute cursor-grab touch-none overflow-hidden rounded-xl border border-rule/70 bg-surface shadow-soft active:cursor-grabbing",
        offSheet && "opacity-50 saturate-50",
      )}
      style={{
        top: (item.startMin - DAY_START) * pxPerMin,
        height,
        left: `${(lane.lane / lane.lanes) * 100}%`,
        width: `calc(${100 / lane.lanes}% - 4px)`,
        marginLeft: 2,
      }}
    >
      <span
        className={cn("absolute inset-y-1 left-1 w-[3px] rounded-full", item.accentClass ?? "bg-zest/70")}
        aria-hidden
      />
      <div className={cn("flex h-full gap-2 pl-3 pr-2", compact ? "items-center py-0.5" : "py-1.5")}>
        <Check
          done={false}
          gate={item.gate}
          label={`Mark "${item.title}" done`}
          className="mt-px h-[18px] w-[18px] shrink-0"
          onToggle={item.onToggleDone}
        />
        <Link to={item.to} params={item.params} draggable={false} className="min-w-0 flex-1">
          <p className={cn("truncate font-medium text-ink", compact ? "text-xs" : "text-[13px]")}>
            {offSheet && <ArrowUpFromLine className="mr-1 inline h-3 w-3 text-ink-muted" />}
            {item.gate && <span className="mr-0.5 text-zest">⛳</span>}
            {item.title}
          </p>
          {!compact && (
            <p className="text-[10px] tabular-nums text-ink-muted">
              {fmtMin(item.startMin)} – {fmtMin(item.startMin + dur)}
            </p>
          )}
        </Link>
      </div>

      {/* The hem: pinch and pull to restretch the slot (pointer-captured, so it
          never fights the block's own drag). */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          resize.current = { pointerId: e.pointerId, fromY: e.clientY, baseDur: item.durMin };
        }}
        onPointerMove={(e) => {
          const r = resize.current;
          if (!r || r.pointerId !== e.pointerId) return;
          const d = clamp(
            snap(r.baseDur + (e.clientY - r.fromY) / pxPerMin),
            SNAP,
            DAY_END - item.startMin,
          );
          setResizeDur(d);
          onGhost({ id: item.key, start: item.startMin, dur: d });
        }}
        onPointerUp={(e) => {
          const r = resize.current;
          if (!r || r.pointerId !== e.pointerId) return;
          resize.current = null;
          onGhost(null);
          if (resizeDur != null && resizeDur !== item.durMin) item.onResize(resizeDur);
          setResizeDur(null);
        }}
        onPointerCancel={() => {
          resize.current = null;
          setResizeDur(null);
          onGhost(null);
        }}
        className="absolute inset-x-0 bottom-0 flex h-3.5 cursor-ns-resize touch-none items-end justify-center pb-1 opacity-60 transition-opacity hover:opacity-100"
        aria-label={`Resize "${item.title}"`}
      >
        <span className="h-[3px] w-7 rounded-full bg-ink/15" />
      </div>
    </motion.div>
  );
});

/** An unscheduled item (task or session) waiting on the shelf — drag it onto
 * an hour to give it a time. */
function ShelfChip({
  item,
  onDropAt,
}: {
  item: Boxed;
  onDropAt: (pageX: number, pageY: number) => void;
}) {
  return (
    <motion.div
      layout
      drag
      dragMomentum={false}
      dragSnapToOrigin
      whileDrag={{ scale: 1.06, rotate: -1.5, zIndex: 40 }}
      whileTap={{ scale: 0.97 }}
      onDragEnd={(_e, info) => onDropAt(info.point.x, info.point.y)}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="grain flex cursor-grab touch-none items-center gap-2 rounded-full border border-rule/70 bg-surface py-1.5 pl-2 pr-3.5 shadow-soft active:cursor-grabbing"
    >
      <Check
        done={false}
        gate={item.gate}
        label={`Mark "${item.title}" done`}
        className="h-[18px] w-[18px]"
        onToggle={item.onToggleDone}
      />
      {item.accentClass && (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", item.accentClass)} aria-hidden />
      )}
      <span className="max-w-44 truncate text-[13px] font-medium text-ink">
        {item.gate && <span className="mr-0.5 text-zest">⛳</span>}
        {item.title}
      </span>
    </motion.div>
  );
}
