import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, Reorder, useDragControls, type DragControls } from "motion/react";
import { Link2, ListChecks, Paperclip, StickyNote, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import type { AgendaExternal, Task } from "../types";
import { localDate, useDayTasks, useDeleteTask, useUpdateTask } from "../api";
import { dayTitle, dueInfo, toLocalNoon } from "../dates";
import { Check } from "@/components/page/Check";
import { BINDING_ROW, BINDING_SLOT, RING_COUNT } from "./PlannerBook";

/** One entry in the unified, reorderable day list. */
type DayRow =
  | { kind: "task"; id: string; sort: number; task: Task }
  | { kind: "ext"; id: string; sort: number; ext: AgendaExternal };

const DAY_MS = 86_400_000;
// Stable default so an omitted `extern` keeps the same reference across
// renders — the render-time sync below compares by identity.
const NO_EXTERN: AgendaExternal[] = [];

/** One planner page: the day's tasks and learning sessions in a single
 * drag-reorderable list, quick-add, and the day's done pile. */
export function AgendaSheet({ date, extern = NO_EXTERN }: { date: string; extern?: AgendaExternal[] }) {
  const { data: tasks, isPending, error } = useDayTasks(date);
  const update = useUpdateTask();

  const buildRows = (): DayRow[] =>
    [
      ...(tasks ?? [])
        .filter((t) => !t.done_at)
        .map((t): DayRow => ({ kind: "task", id: t.id, sort: t.sort_order, task: t })),
      ...extern
        .filter((e) => !e.done)
        .map((e): DayRow => ({ kind: "ext", id: e.id, sort: e.sort, ext: e })),
    ].sort((a, b) => a.sort - b.sort);

  const doneTasks = (tasks ?? []).filter((t) => t.done_at);
  const doneExtern = extern.filter((e) => e.done);

  // Local order so drags feel free, reset in render whenever source data changes
  // (the render-time-adjust pattern from the React docs — no effect needed).
  const [order, setOrder] = useState<DayRow[]>(buildRows);
  const [synced, setSynced] = useState<[typeof tasks, typeof extern]>([tasks, extern]);
  if (tasks !== synced[0] || extern !== synced[1]) {
    setSynced([tasks, extern]);
    setOrder(buildRows());
  }

  const applySort = (row: DayRow, sort: number) => {
    if (row.kind === "task") update.mutate({ id: row.id, patch: { sort_order: sort } });
    else row.ext.onSort(sort);
  };

  /** Persist a drop: midpoint between neighbors, dense reindex when midpoints run out. */
  const persistOrder = (row: DayRow) => {
    const idx = order.findIndex((r) => r.id === row.id);
    const prev = order[idx - 1]?.sort;
    const next = order[idx + 1]?.sort;
    if (prev == null && next == null) return;
    const target = prev == null ? next! - DAY_MS : next == null ? prev + DAY_MS : (prev + next) / 2;
    const collided =
      !Number.isFinite(target) || (prev != null && target <= prev) || (next != null && target >= next);
    if (collided) order.forEach((r, i) => applySort(r, (i + 1) * DAY_MS));
    else applySort(row, target);
  };

  return (
    <Panel className="p-5 pt-9 md:p-7 md:pt-10">
      {/* Punched holes — same slot geometry as the binder rings, so the wire
          lands dead-center in each hole. */}
      <div aria-hidden className={`${BINDING_ROW} pointer-events-none top-[9px]`}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <span key={i} className={BINDING_SLOT}>
            <span className="inset-well h-2.5 w-2.5 rounded-full bg-gradient-to-b from-ink/25 to-ink/10" />
          </span>
        ))}
      </div>

      <SheetHeading date={date} count={order.length} />

      {error && (
        <p className="mt-3 rounded-xl border border-clay/40 bg-clay/10 p-3 text-sm text-ink">
          Couldn&apos;t load this day. <span className="font-mono text-xs text-ink-muted">{error.message}</span>
        </p>
      )}
      {isPending && !error && <GhostLines />}

      {tasks && (
        <>
          <Reorder.Group axis="y" values={order} onReorder={setOrder} className="mt-1">
            <AnimatePresence mode="popLayout" initial={false}>
              {order.map((row) =>
                row.kind === "task" ? (
                  <TaskRow key={row.id} task={row.task} date={date} onDrop={() => persistOrder(row)} row={row} />
                ) : (
                  <ExtRow key={row.id} ext={row.ext} onDrop={() => persistOrder(row)} row={row} />
                ),
              )}
            </AnimatePresence>
          </Reorder.Group>

          {order.length === 0 && doneTasks.length === 0 && doneExtern.length === 0 && (
            <p className="mt-3 px-2 text-sm text-ink-muted">Nothing planned — the day is yours.</p>
          )}

          {doneTasks.length + doneExtern.length > 0 && (
            <div className="mt-5">
              <Eyebrow>done</Eyebrow>
              <ul className="mt-1">
                <AnimatePresence mode="popLayout" initial={false}>
                  {doneTasks.map((t) => (
                    <DoneTaskRow key={t.id} task={t} />
                  ))}
                  {doneExtern.map((e) => (
                    <DoneExtRow key={e.id} ext={e} />
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** The sheet's date line: the day in display type, the actual date inked on as
 * a small rubber stamp, and the open count in a pressed counter chip. */
export function SheetHeading({ date, count }: { date: string; count: number }) {
  const stampText = toLocalNoon(date).toLocaleDateString("en", { month: "short", day: "numeric" });
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <h2 className="truncate font-display text-2xl font-bold tracking-tight text-ink">
          {dayTitle(date)}
        </h2>
        <Stamp rotate={-4} className={cn(date === localDate() ? "border-zest text-zest" : "border-ink-muted/50 text-ink-muted")}>
          {stampText}
        </Stamp>
      </span>
      {count > 0 && (
        <span className="inset-well shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] tabular-nums text-ink-muted">
          {count} to do
        </span>
      )}
    </div>
  );
}


const rowMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97 },
  transition: { type: "spring", stiffness: 420, damping: 32 } as const,
  whileDrag: { scale: 1.02, backgroundColor: "hsl(var(--surface))", boxShadow: "var(--soft-shadow)" },
  className:
    "group relative -mx-2 select-none list-none rounded-xl border-t border-rule/50 first:border-t-0",
  style: { WebkitTouchCallout: "none" } as React.CSSProperties,
};

/** Grab-to-drag, no handle. Mouse: the drag arms on press, so just grab and
 * pull — motion's own movement threshold keeps plain clicks working. Touch:
 * hold a beat to lift (instant vertical movement must stay a scroll); moving
 * before the beat cancels the pickup. While a drag is live, a non-passive
 * touchmove listener keeps the browser from stealing the gesture. */
function useHoldToDrag(controls: DragControls) {
  const timer = useRef<number | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };

  const begin = (e: React.PointerEvent) => {
    controls.start(e);
    const prevent = (ev: TouchEvent) => ev.preventDefault();
    document.addEventListener("touchmove", prevent, { passive: false });
    const cleanup = () => {
      document.removeEventListener("touchmove", prevent);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") {
        if (e.button === 0) begin(e);
        return;
      }
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        begin(e);
      }, 250);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer.current == null || !from.current) return;
      if (Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

/** One agenda row, tasks and sessions alike: check, title with the meta
 * cluster on its line, and the description tucked underneath. The whole row is
 * the drag trigger (handlers spread onto the root) — motion's controls.start
 * must fire from this child, not the Reorder.Item itself, to take effect. */
function RowBody({
  check,
  to,
  params,
  title,
  subtitle,
  titleAccessory,
  trailing,
  dragProps,
}: {
  check: React.ReactNode;
  to: string;
  params: Record<string, string>;
  title: React.ReactNode;
  subtitle?: string;
  titleAccessory?: React.ReactNode;
  trailing?: React.ReactNode;
  dragProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <div
      {...dragProps}
      className="flex cursor-grab touch-pan-y items-start gap-2.5 py-2.5 pl-1 pr-2 active:cursor-grabbing"
    >
      <span className="mt-px">{check}</span>
      <Link to={to} params={params} className="min-w-0 flex-1" draggable={false}>
        <span className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate text-[15px] leading-tight text-ink">{title}</span>
          {titleAccessory}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-xs leading-snug text-ink-muted">
            {subtitle}
          </span>
        )}
      </Link>
      {trailing}
    </div>
  );
}

function TaskRow({ task, date, onDrop, row }: { task: Task; date: string; onDrop: () => void; row: DayRow }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const controls = useDragControls();
  const hold = useHoldToDrag(controls);
  const dragging = useRef(false);
  const viewingToday = date === localDate();

  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => (dragging.current = true)}
      onDragEnd={() => {
        onDrop();
        setTimeout(() => (dragging.current = false), 0);
      }}
      onClickCapture={(e) => {
        if (dragging.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...rowMotion}
    >
      <RowBody
        dragProps={hold}
        check={
          <Check
            done={false}
            label={`Mark "${task.title}" done`}
            className="h-[22px] w-[22px]"
            onToggle={() => update.mutate({ id: task.id, patch: { done_at: new Date().toISOString() } })}
          />
        }
        to="/task/$id"
        params={{ id: task.id }}
        title={task.title}
        subtitle={task.description || undefined}
        titleAccessory={
          <>
            <RowMeta task={task} />
            {viewingToday && task.due_date && <DueChip due={task.due_date} />}
          </>
        }
        trailing={
          <button
            type="button"
            onClick={() => del.mutate(task.id)}
            aria-label={`Delete "${task.title}"`}
            className="mt-1 text-ink-muted/50 opacity-0 transition-[opacity,color] hover:text-clay focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        }
      />
    </Reorder.Item>
  );
}

/** A learning session living in the same list as tasks — same row shape,
 * draggable, tickable, and it opens its own page. */
function ExtRow({ ext, onDrop, row }: { ext: AgendaExternal; onDrop: () => void; row: DayRow }) {
  const controls = useDragControls();
  const hold = useHoldToDrag(controls);
  const dragging = useRef(false);
  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => (dragging.current = true)}
      onDragEnd={() => {
        onDrop();
        setTimeout(() => (dragging.current = false), 0);
      }}
      onClickCapture={(e) => {
        if (dragging.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      {...rowMotion}
    >
      <RowBody
        dragProps={hold}
        check={
          <Check
            done={false}
            gate={ext.gate}
            label={`Complete ${ext.title}`}
            className="h-[22px] w-[22px]"
            onToggle={ext.onToggle}
          />
        }
        to={ext.to}
        params={ext.params}
        title={
          <>
            {ext.gate && <span className="mr-1 text-zest">⛳</span>}
            {ext.title}
          </>
        }
        subtitle={ext.subtitle}
        titleAccessory={
          ext.badge ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted">
              <span className={cn("inline-block h-2 w-2 rounded-full", ext.accentClass)} />
              <span className="max-w-28 truncate">{ext.badge}</span>
            </span>
          ) : undefined
        }
      />
    </Reorder.Item>
  );
}

function DoneTaskRow({ task }: { task: Task }) {
  const update = useUpdateTask();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group -mx-2 flex items-center gap-2.5 rounded-xl border-t border-rule/50 py-2.5 pl-3 pr-2 first:border-t-0"
    >
      <Check
        done
        label={`Mark "${task.title}" not done`}
        className="h-[22px] w-[22px]"
        onToggle={() => update.mutate({ id: task.id, patch: { done_at: "" } })}
      />
      <Link
        to="/task/$id"
        params={{ id: task.id }}
        className="min-w-0 flex-1 truncate text-[15px] text-ink-muted line-through decoration-rule"
      >
        {task.title}
      </Link>
    </motion.li>
  );
}

function DoneExtRow({ ext }: { ext: AgendaExternal }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group -mx-2 flex items-center gap-2.5 rounded-xl border-t border-rule/50 py-2.5 pl-3 pr-2 first:border-t-0"
    >
      <Check
        done
        label={`Reopen ${ext.title}`}
        className="h-[22px] w-[22px]"
        onToggle={ext.onToggle}
      />
      <Link
        to={ext.to}
        params={ext.params}
        className="min-w-0 flex-1 truncate text-[15px] text-ink-muted line-through decoration-rule"
      >
        {ext.title}
      </Link>
      {ext.badge && (
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted/60">
          <span className={cn("inline-block h-2 w-2 rounded-full", ext.accentClass)} />
          <span className="max-w-28 truncate">{ext.badge}</span>
        </span>
      )}
    </motion.li>
  );
}

/** The info cluster: notes, checklist progress, links, files. Kept out of the
 * way — it fades in on hover (desktop) and stays hidden on touch. */
function RowMeta({ task }: { task: Task }) {
  const ticked = task.checklist.filter((i) => i.done).length;
  return (
    <span className="hidden shrink-0 items-center gap-2 text-[11px] tabular-nums text-ink-muted/70 opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
      {task.notes && <StickyNote className="h-3 w-3" />}
      {task.checklist.length > 0 && (
        <span className="flex items-center gap-0.5">
          <ListChecks className="h-3 w-3" />
          {ticked}/{task.checklist.length}
        </span>
      )}
      {task.resources.length > 0 && (
        <span className="flex items-center gap-0.5">
          <Link2 className="h-3 w-3" />
          {task.resources.length}
        </span>
      )}
      {task.attachments.length > 0 && <Paperclip className="h-3 w-3" />}
    </span>
  );
}

function DueChip({ due }: { due: string }) {
  const { text, tone } = dueInfo(due);
  if (tone === "future") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
        tone === "overdue" ? "border-clay/40 bg-clay/10 text-clay" : "border-zest/40 bg-zest/10 text-zest",
      )}
    >
      {text}
    </span>
  );
}

function GhostLines() {
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-xl bg-ink/[0.04]"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}
