// The day list (unit 4.3, ported from src-legacy/features/tasks/components/AgendaSheet.tsx onto
// Lynx): one planner page - the day's open tasks (and learning sessions) as an ordered list with
// check-off, open-on-tap, and delete, plus the day's done pile. `SheetHeading` is EXPORTED
// (TimeboxSheet imports it).
//
// DROPPED to unit 5.2 (the MTS gesture unit, ruling R3): the ENTIRE reorder gesture -
// `Reorder.Group`/`Reorder.Item`, `useDragControls`, `useHoldToDrag` (the hold-timer + document
// touchmove listeners), `onDragStart`/`onDragEnd`/`onClickCapture`, `whileDrag`, `persistOrder`/
// `applySort`, and the local `order`/`synced` render-time-reorder state. This unit renders
// `buildRows()` DIRECTLY as a `<view>` list ordered by `sort_order` (read-only order until 5.2).
//
// DROPPED (recorded BROOM): `motion`/`AnimatePresence` row springs -> a CSS enter (animate-enter,
// styles/global.css) gated on reduced-motion; `motion.li` -> `<view>`; `lucide-react` -> the L2
// icon set; `Link to="/task/$id"` -> `<view bindtap>` calling navigate; the `group-hover` reveal
// of the meta cluster + delete -> ALWAYS-VISIBLE (Lynx has no hover). NOTE: a true row EXIT spring
// needs presence tracking (AnimatePresence) - rows leave by unmounting, so exit is instant here;
// enter choreography is preserved. A dedicated inner `<scroll-view>` for very long days is deferred
// (page-level scroll covers overflow; capping the sheet's own height is an L5 calendar-layout
// concern) - recorded, not faked.
//
// The `extern`/`AgendaExternal` (learning-session) path is KEPT (prop default `[]` + ExtRow render)
// but no unit feeds it until L6 (SPEC 7 decision); it is a real, typed, soon-used path.
import { useNavigate } from "@tanstack/react-router";

import { Check } from "@/components/page/Check";
import { Link2, ListChecks, Paperclip, StickyNote, Trash2 } from "@/components/icons/lucide";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "@/stores";
import { localDate, useDayTasks, useDeleteTask, useUpdateTask } from "../api";
import { dayTitle, dueInfo, toLocalNoon } from "../dates";
import type { AgendaExternal, Task } from "../types";
import { BINDING_ROW, BINDING_SLOT, RING_COUNT } from "./PlannerBook";

/** One entry in the unified day list. */
type DayRow =
  | { kind: "task"; id: string; sort: number; task: Task }
  | { kind: "ext"; id: string; sort: number; ext: AgendaExternal };

// Stable default so an omitted `extern` keeps the same reference across renders.
const NO_EXTERN: AgendaExternal[] = [];

/** One planner page: the day's tasks and learning sessions in a single ordered list, plus the
 * day's done pile. */
export function AgendaSheet({
  date,
  extern = NO_EXTERN,
}: {
  date: string;
  extern?: AgendaExternal[];
}) {
  const { data: tasks, isPending, error } = useDayTasks(date);

  const rows: DayRow[] = [
    ...(tasks ?? [])
      .filter((t) => !t.done_at)
      .map((t): DayRow => ({ kind: "task", id: t.id, sort: t.sort_order, task: t })),
    ...extern
      .filter((e) => !e.done)
      .map((e): DayRow => ({ kind: "ext", id: e.id, sort: e.sort, ext: e })),
  ].sort((a, b) => a.sort - b.sort);

  const doneTasks = (tasks ?? []).filter((t) => t.done_at);
  const doneExtern = extern.filter((e) => e.done);

  return (
    <Panel className="p-5 pt-9 md:p-7 md:pt-10" data-testid="agenda-sheet">
      {/* Punched holes - same slot geometry as the binder rings (SPEC 6). */}
      <view aria-hidden className={`${BINDING_ROW} pointer-events-none top-[9px]`}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <view key={i} className={BINDING_SLOT}>
            <view className="inset-well h-2.5 w-2.5 rounded-full bg-gradient-to-b from-ink/25 to-ink/10" />
          </view>
        ))}
      </view>

      <SheetHeading date={date} count={rows.length} />

      {error && (
        <view className="mt-3 rounded-xl border border-clay/40 bg-clay/10 p-3">
          <text className="text-sm text-ink">Couldn't load this day. </text>
          <text className="font-mono text-xs text-ink-muted">{error.message}</text>
        </view>
      )}
      {isPending && !error && <GhostLines />}

      {tasks && (
        <>
          <view className="mt-1">
            {rows.map((row) =>
              row.kind === "task" ? (
                <TaskRow key={row.id} task={row.task} date={date} />
              ) : (
                <ExtRow key={row.id} ext={row.ext} />
              ),
            )}
          </view>

          {rows.length === 0 && doneTasks.length === 0 && doneExtern.length === 0 && (
            <text className="mt-3 px-2 text-sm text-ink-muted">
              Nothing planned - the day is yours.
            </text>
          )}

          {doneTasks.length + doneExtern.length > 0 && (
            <view className="mt-5">
              <Eyebrow>done</Eyebrow>
              <view className="mt-1">
                {doneTasks.map((t) => (
                  <DoneTaskRow key={t.id} task={t} />
                ))}
                {doneExtern.map((e) => (
                  <DoneExtRow key={e.id} ext={e} />
                ))}
              </view>
            </view>
          )}
        </>
      )}
    </Panel>
  );
}

/** The sheet's date line: the day in display type, the actual date inked on as a small rubber
 * stamp, and the open count in a pressed counter chip. */
export function SheetHeading({ date, count }: { date: string; count: number }) {
  const stampText = toLocalNoon(date).toLocaleDateString("en", { month: "short", day: "numeric" });
  return (
    <view className="flex items-center justify-between gap-3">
      <view className="flex min-w-0 items-center gap-3">
        <text className="truncate font-display text-2xl font-bold tracking-tight text-ink">
          {dayTitle(date)}
        </text>
        <Stamp
          rotate={-4}
          className={cn(
            date === localDate() ? "border-zest text-zest" : "border-ink-muted/50 text-ink-muted",
          )}
        >
          {stampText}
        </Stamp>
      </view>
      {count > 0 && (
        <view className="inset-well shrink-0 rounded-full bg-ink/5 px-2.5 py-1">
          <text className="text-[11px] tabular-nums text-ink-muted">{count} to do</text>
        </view>
      )}
    </view>
  );
}

const ROW_CLASS =
  "relative -mx-2 flex items-start gap-2.5 rounded-xl border-t border-rule/50 py-2.5 pl-1 pr-2 first:border-t-0";

/** One agenda row body: check, a tap-to-open title cluster, and trailing controls. */
function RowBody({
  check,
  onOpen,
  title,
  subtitle,
  titleAccessory,
  trailing,
}: {
  check: React.ReactNode;
  onOpen: () => void;
  title: React.ReactNode;
  subtitle?: string;
  titleAccessory?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <>
      <view className="mt-px">{check}</view>
      <view
        bindtap={onOpen}
        accessibility-traits="button"
        data-testid="agenda-row-open"
        className="min-w-0 flex-1 active:opacity-70"
      >
        <view className="flex items-center gap-2.5">
          <text className="min-w-0 flex-1 truncate text-[15px] leading-tight text-ink">
            {title}
          </text>
          {titleAccessory}
        </view>
        {subtitle && (
          <text className="mt-0.5 block truncate text-xs leading-snug text-ink-muted">
            {subtitle}
          </text>
        )}
      </view>
      {trailing}
    </>
  );
}

function TaskRow({ task, date }: { task: Task; date: string }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const viewingToday = date === localDate();

  return (
    <view data-testid="agenda-row" className={cn(ROW_CLASS, !reduced && "animate-enter")}>
      <RowBody
        onOpen={() => void navigate({ to: "/task/$id", params: { id: task.id } })}
        check={
          <Check
            done={false}
            label={`Mark "${task.title}" done`}
            className="h-[22px] w-[22px]"
            onToggle={() =>
              update.mutate({ id: task.id, patch: { done_at: new Date().toISOString() } })
            }
          />
        }
        title={task.title}
        subtitle={task.description || undefined}
        titleAccessory={
          <>
            <RowMeta task={task} />
            {viewingToday && task.due_date ? <DueChip due={task.due_date} /> : null}
          </>
        }
        trailing={
          <view
            bindtap={() => del.mutate(task.id)}
            accessibility-label={`Delete "${task.title}"`}
            accessibility-traits="button"
            data-testid="agenda-delete"
            className="mt-1 active:scale-90"
          >
            <Trash2 className="h-3.5 w-3.5 text-ink-muted/50" />
          </view>
        }
      />
    </view>
  );
}

/** A learning session living in the same list as tasks (KEPT, fed by L6). */
function ExtRow({ ext }: { ext: AgendaExternal }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  return (
    <view data-testid="agenda-row" className={cn(ROW_CLASS, !reduced && "animate-enter")}>
      <RowBody
        onOpen={() => void navigate({ to: ext.to, params: ext.params } as never)}
        check={
          <Check
            done={false}
            gate={ext.gate}
            label={`Complete ${ext.title}`}
            className="h-[22px] w-[22px]"
            onToggle={ext.onToggle}
          />
        }
        title={
          <>
            {ext.gate ? "⛳ " : ""}
            {ext.title}
          </>
        }
        subtitle={ext.subtitle}
        titleAccessory={
          ext.badge ? (
            <view className="flex shrink-0 items-center gap-1.5">
              <view className={cn("inline-block h-2 w-2 rounded-full", ext.accentClass)} />
              <text className="max-w-28 truncate text-[11px] text-ink-muted">{ext.badge}</text>
            </view>
          ) : undefined
        }
      />
    </view>
  );
}

function DoneTaskRow({ task }: { task: Task }) {
  const update = useUpdateTask();
  const navigate = useNavigate();
  return (
    <view className="group -mx-2 flex items-center gap-2.5 rounded-xl border-t border-rule/50 py-2.5 pl-3 pr-2 first:border-t-0">
      <Check
        done
        label={`Mark "${task.title}" not done`}
        className="h-[22px] w-[22px]"
        onToggle={() => update.mutate({ id: task.id, patch: { done_at: "" } })}
      />
      <view
        bindtap={() => void navigate({ to: "/task/$id", params: { id: task.id } })}
        accessibility-traits="button"
        className="min-w-0 flex-1 active:opacity-70"
      >
        <text className="truncate text-[15px] text-ink-muted line-through">{task.title}</text>
      </view>
    </view>
  );
}

function DoneExtRow({ ext }: { ext: AgendaExternal }) {
  const navigate = useNavigate();
  return (
    <view className="group -mx-2 flex items-center gap-2.5 rounded-xl border-t border-rule/50 py-2.5 pl-3 pr-2 first:border-t-0">
      <Check
        done
        label={`Reopen ${ext.title}`}
        className="h-[22px] w-[22px]"
        onToggle={ext.onToggle}
      />
      <view
        bindtap={() => void navigate({ to: ext.to, params: ext.params } as never)}
        accessibility-traits="button"
        className="min-w-0 flex-1 active:opacity-70"
      >
        <text className="truncate text-[15px] text-ink-muted line-through">{ext.title}</text>
      </view>
      {ext.badge && (
        <view className="flex shrink-0 items-center gap-1.5">
          <view className={cn("inline-block h-2 w-2 rounded-full", ext.accentClass)} />
          <text className="max-w-28 truncate text-[11px] text-ink-muted/60">{ext.badge}</text>
        </view>
      )}
    </view>
  );
}

/** The info cluster: notes, checklist progress, links, files. Always visible (no hover on Lynx). */
function RowMeta({ task }: { task: Task }) {
  const ticked = task.checklist.filter((i) => i.done).length;
  const hasMeta =
    task.notes || task.checklist.length > 0 || task.resources.length > 0 || task.attachments.length > 0;
  if (!hasMeta) return null;
  return (
    <view className="flex shrink-0 items-center gap-2">
      {task.notes && <StickyNote className="h-3 w-3 text-ink-muted/70" />}
      {task.checklist.length > 0 && (
        <view className="flex items-center gap-0.5">
          <ListChecks className="h-3 w-3 text-ink-muted/70" />
          <text className="text-[11px] tabular-nums text-ink-muted/70">
            {ticked}/{task.checklist.length}
          </text>
        </view>
      )}
      {task.resources.length > 0 && (
        <view className="flex items-center gap-0.5">
          <Link2 className="h-3 w-3 text-ink-muted/70" />
          <text className="text-[11px] tabular-nums text-ink-muted/70">{task.resources.length}</text>
        </view>
      )}
      {task.attachments.length > 0 && <Paperclip className="h-3 w-3 text-ink-muted/70" />}
    </view>
  );
}

function DueChip({ due }: { due: string }) {
  const { text, tone } = dueInfo(due);
  if (tone === "future") return null;
  return (
    <view
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5",
        tone === "overdue" ? "border-clay/40 bg-clay/10" : "border-zest/40 bg-zest/10",
      )}
    >
      <text
        className={cn(
          "text-[10px] font-medium uppercase tracking-[0.12em]",
          tone === "overdue" ? "text-clay" : "text-zest",
        )}
      >
        {text}
      </text>
    </view>
  );
}

function GhostLines() {
  return (
    <view className="mt-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <view key={i} className="mb-2 h-9 animate-pulse rounded-xl bg-ink/[0.04]" />
      ))}
    </view>
  );
}
