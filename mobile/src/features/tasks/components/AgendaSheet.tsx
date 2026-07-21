import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "@/components/Check";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { dayTitle, dueInfo, localDate, toLocalNoon } from "@/lib/dates";
import { hapticLift, hapticTap, hapticWarn } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDayTasks, useDeleteTask, useUpdateTask } from "../api";
import type { Task } from "../types";
import { BINDING_INSET, RING_COUNT } from "./PlannerBook";

const settle = LinearTransition.springify().stiffness(420).damping(32);
const ROW_H = 56;
const CHECK_LINE_H = 26; // one checklist line tucked under the title
const REVEAL_W = 72; // how far a row swipes right to bare its delete
const DAY_MS = 86_400_000;
const LIFT = { stiffness: 420, damping: 34 };

/** A row grows with its checklist — heights come from data, so the drag math
 * and the layout can never disagree. */
const rowHeight = (t: Task) =>
  ROW_H + (t.checklist.length ? t.checklist.length * CHECK_LINE_H + 8 : 0);

/** One planner page: the day's open tasks in a hold-to-drag reorderable list,
 * and the day's done pile. Rows open the task's page. */
export function AgendaSheet({ date, height }: { date: string; height?: number }) {
  const colors = usePalette();
  const type = useType();
  const { data: tasks, isPending, error } = useDayTasks(date);

  const open = useMemo(() => (tasks ?? []).filter((t) => !t.done_at), [tasks]);
  const done = (tasks ?? []).filter((t) => t.done_at);

  const body = (
    <>
      {error && (
        <View
          style={[
            styles.errorBox,
            { borderColor: alpha(colors.clay, 0.4), backgroundColor: alpha(colors.clay, 0.1) },
          ]}
        >
          <Text style={[styles.errorText, type.sans, { color: colors.ink }]}>
            Couldn't load this day. {error.message}
          </Text>
        </View>
      )}
      {isPending && !error && <GhostLines />}

      {tasks && (
        <>
          <ReorderableRows rows={open} date={date} />

          {open.length === 0 && done.length === 0 && (
            <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
              Nothing planned — the day is yours.
            </Text>
          )}

          {done.length > 0 && (
            <Animated.View layout={settle} style={styles.donePile}>
              <Eyebrow>done</Eyebrow>
              {done.map((t) => (
                <DoneTaskRow key={t.id} task={t} />
              ))}
            </Animated.View>
          )}
        </>
      )}
    </>
  );

  return (
    <PageSheet date={date} count={open.length} height={height}>
      {body}
    </PageSheet>
  );
}

/** The planner page itself, shared by every day view: the punched paper sheet
 * with its heading pinned at the top and the content scrolling INSIDE it. */
export function PageSheet({
  date,
  count,
  height,
  children,
}: {
  date: string;
  count: number;
  height?: number;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <View>
      <Panel style={[styles.sheet, height != null && { height }]}>
        <SheetHeading date={date} count={count} />
        {height != null ? (
          // Pinned page: the heading stays inked at the top, the day's
          // content scrolls inside the paper. The scroller spans the panel's
          // full width so rows bleeding past the padding aren't clipped.
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </Panel>

      {/* Punched holes — drawn on an unbordered wrapper (not inside the Panel,
          whose 1px border would nudge the percentage box inward) so they use
          the exact same width as the binder rings and line up dead-center. */}
      <View pointerEvents="none" style={styles.holesRow}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <View key={i} style={styles.holeSlot}>
            {/* Punched wells, lit from above — the web's ink/25 → ink/10 fade. */}
            <LinearGradient
              colors={[alpha(colors.ink, 0.25), alpha(colors.ink, 0.1)]}
              style={styles.hole}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/** The sheet's date line: the day in display type, the actual date inked on as
 * a small rubber stamp, and the open count in a pressed counter chip. */
export function SheetHeading({ date, count }: { date: string; count: number }) {
  const colors = usePalette();
  const type = useType();
  const isToday = date === localDate();
  const stampText = toLocalNoon(date).toLocaleDateString("en", { month: "short", day: "numeric" });
  return (
    <View style={styles.heading}>
      <View style={styles.headingLeft}>
        <Text numberOfLines={1} style={[styles.headingTitle, type.display, { color: colors.ink }]}>
          {dayTitle(date)}
        </Text>
        <Stamp rotate={-4} color={isToday ? colors.zest : alpha(colors.inkMuted, 0.8)}>
          {stampText}
        </Stamp>
      </View>
      {count > 0 && (
        <View style={[styles.counter, { backgroundColor: alpha(colors.ink, 0.05) }]}>
          <Text style={[styles.counterText, type.sans, { color: colors.inkMuted }]}>
            {count} to do
          </Text>
        </View>
      )}
    </View>
  );
}

/** Hold a row a beat to lift it, then drag — the others part on springs. On
 * drop the new slot persists as a midpoint sort (dense reindex on collision),
 * exactly like the web planner. Rows are as tall as their checklists. */
function ReorderableRows({ rows, date }: { rows: Task[]; date: string }) {
  const update = useUpdateTask();
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(rows.map((r, i) => [r.id, i])),
  );
  const heightsObj = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, rowHeight(r)])),
    [rows],
  );
  const heights = useSharedValue<Record<string, number>>(heightsObj);
  // Which row is baring its delete — swiping (or lifting) one closes the rest.
  const revealed = useSharedValue<string | null>(null);

  // Re-sync slots whenever the server list changes (adds, deletes, check-offs).
  const signature = rows.map((r) => r.id).join("|");
  useEffect(() => {
    positions.value = Object.fromEntries(rows.map((r, i) => [r.id, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => {
    heights.value = heightsObj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heightsObj]);

  const commit = (id: string) => {
    const order = [...rows].sort(
      (a, b) => (positions.value[a.id] ?? 0) - (positions.value[b.id] ?? 0),
    );
    const idx = order.findIndex((r) => r.id === id);
    const prev = order[idx - 1]?.sort_order;
    const next = order[idx + 1]?.sort_order;
    if (prev == null && next == null) return;
    const target = prev == null ? next! - DAY_MS : next == null ? prev + DAY_MS : (prev + next) / 2;
    const collided =
      !Number.isFinite(target) || (prev != null && target <= prev) || (next != null && target >= next);
    if (collided) {
      order.forEach((r, i) => update.mutate({ id: r.id, patch: { sort_order: (i + 1) * DAY_MS } }));
    } else {
      update.mutate({ id, patch: { sort_order: target } });
    }
  };

  const listHeight = rows.reduce((sum, r) => sum + rowHeight(r), 0);

  return (
    <View style={[styles.list, { height: listHeight }]}>
      {rows.map((t, i) => (
        <DraggableRow
          key={t.id}
          task={t}
          index={i}
          count={rows.length}
          date={date}
          positions={positions}
          heights={heights}
          revealed={revealed}
          onDrop={commit}
        />
      ))}
    </View>
  );
}

function DraggableRow({
  task,
  index,
  count,
  date,
  positions,
  heights,
  revealed,
  onDrop,
}: {
  task: Task;
  index: number;
  count: number;
  date: string;
  positions: SharedValue<Record<string, number>>;
  heights: SharedValue<Record<string, number>>;
  revealed: SharedValue<string | null>;
  onDrop: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const id = task.id;
  const h = rowHeight(task);
  const web = Platform.OS === "web";
  const [hovered, setHovered] = useState(false);

  const dragging = useSharedValue(false);
  const y = useSharedValue(0);
  const startY = useSharedValue(0);
  const reveal = useSharedValue(0);
  const revealStart = useSharedValue(0);
  // On the web the click fires AFTER the drag releases — swallow it, or every
  // drop also opens the task's page.
  const justDragged = useRef(false);
  const endDrag = () => {
    onDrop(id);
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 250);
  };

  const lift = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      dragging.value = true;
      revealed.value = null;
      runOnJS(hapticLift)();
      let top = 0;
      const idx = positions.value[id] ?? index;
      for (const k in positions.value) {
        if (k !== id && positions.value[k] < idx) top += heights.value[k] ?? ROW_H;
      }
      startY.value = top;
      y.value = top;
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      // Which slot does the dragged row's centre fall into, heights and all?
      const centerY = y.value + (heights.value[id] ?? ROW_H) / 2;
      const others = Object.entries(positions.value)
        .filter(([k]) => k !== id)
        .sort((a, b) => a[1] - b[1]);
      let acc = 0;
      let newIdx = others.length;
      for (let i = 0; i < others.length; i++) {
        const hh = heights.value[others[i][0]] ?? ROW_H;
        if (centerY < acc + hh / 2) {
          newIdx = i;
          break;
        }
        acc += hh;
      }
      if (newIdx !== positions.value[id]) {
        const next: Record<string, number> = { [id]: newIdx };
        others.forEach(([k], i) => {
          next[k] = i >= newIdx ? i + 1 : i;
        });
        positions.value = next;
      }
    })
    // onEnd, not onFinalize: only a drag that actually lifted commits an
    // order — a plain tap must not touch sort_order at all.
    .onEnd(() => {
      runOnJS(endDrag)();
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  // Swipe the row LEFT to bare its delete on the right, iOS-style (native
  // only — the web shows the trash on hover instead). Horizontal-only: any
  // vertical drift fails it so scrolling and the long-press lift keep working.
  const swipe = Gesture.Pan()
    .enabled(!web)
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onStart(() => {
      revealStart.value = reveal.value;
      revealed.value = id;
    })
    .onUpdate((e) => {
      reveal.value = Math.max(0, Math.min(REVEAL_W, revealStart.value - e.translationX));
    })
    .onEnd(() => {
      const open = reveal.value > REVEAL_W / 2;
      reveal.value = withSpring(open ? REVEAL_W : 0, LIFT);
      if (open) runOnJS(hapticTap)();
      else revealed.value = null;
    });

  // Another row swiping (or this one lifting) tucks this delete back in.
  useAnimatedReaction(
    () => revealed.value,
    (open) => {
      if (open !== id && reveal.value > 0) reveal.value = withSpring(0, LIFT);
    },
  );

  const closeReveal = () => {
    revealed.value = null;
    reveal.value = withSpring(0, LIFT);
  };

  // The row is bare paper until it's lifted — only a live drag earns the
  // card treatment (surface fill, shadow, slight grow), like the web.
  const surface = colors.surface;
  const rule = alpha(colors.rule, 0.5);
  const rowStyle = useAnimatedStyle(() => {
    const idx = positions.value[id] ?? index;
    let top = 0;
    for (const k in positions.value) {
      if (k !== id && positions.value[k] < idx) top += heights.value[k] ?? ROW_H;
    }
    return dragging.value
      ? {
          top: y.value,
          zIndex: 20,
          backgroundColor: surface,
          shadowOpacity: 0.18,
          elevation: 6,
          transform: [{ scale: 1.02 }],
          borderTopColor: "transparent",
        }
      : {
          top: withSpring(top, LIFT),
          zIndex: 0,
          backgroundColor: "transparent",
          shadowOpacity: 0,
          elevation: 0,
          transform: [{ scale: withSpring(1, LIFT) }],
          // The hairline rides the row (web: border-t, first:border-t-0) so
          // it parts with the rows instead of floating between slots.
          borderTopColor: idx === 0 ? "transparent" : rule,
        };
  });
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -reveal.value }],
  }));
  const underStyle = useAnimatedStyle(() => ({
    opacity: reveal.value / REVEAL_W,
  }));

  const due = date === localDate() && task.due_date ? dueInfo(task.due_date) : null;
  const toggleItem = (itemId: string) =>
    update.mutate({
      id,
      patch: {
        checklist: task.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
      },
    });

  return (
    <GestureDetector gesture={Gesture.Race(swipe, lift)}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={[styles.row, { height: h }, rowStyle, { shadowColor: "#282018" }]}
      >
        <View style={styles.rowClip}>
          {!web && (
            <Animated.View style={[styles.deleteUnder, underStyle]}>
              <Pressable
                accessibilityLabel={`Delete "${task.title}"`}
                onPress={() => {
                  hapticWarn();
                  del.mutate(id);
                }}
                style={[styles.deleteBtn, { backgroundColor: alpha(colors.clay, 0.14) }]}
              >
                <Trash2 size={16} color={colors.clay} />
              </Pressable>
            </Animated.View>
          )}
          <Animated.View style={[styles.rowCard, cardStyle]}>
            {/* The WHOLE row opens the task's page; the check, the checklist
                lines and the trash are nested pressables, so they win their
                own taps. Holding anywhere lifts the row for a drag — the
                pressed wash tells your finger the row heard it. */}
            <Pressable
              style={({ pressed }) => [
                styles.rowPress,
                pressed && { backgroundColor: alpha(colors.ink, 0.04), borderRadius: 14 },
                web && ({ cursor: "grab" } as unknown as ViewStyle),
              ]}
              onPress={() => {
                if (justDragged.current) return;
                if (!web && reveal.value > 0) closeReveal();
                else router.push(`/task/${id}`);
              }}
              onHoverIn={web ? () => setHovered(true) : undefined}
              onHoverOut={web ? () => setHovered(false) : undefined}
            >
              <View style={styles.rowCheck}>
                <Check
                  done={false}
                  gate={task.gate}
                  label={`Mark "${task.title}" done`}
                  size={22}
                  onToggle={() =>
                    update.mutate({ id, patch: { done_at: new Date().toISOString() } })
                  }
                />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowMain}>
                  <View style={styles.rowTitleLine}>
                    {task.gate && <Text style={{ color: colors.zest }}>⛳</Text>}
                    <Text
                      numberOfLines={1}
                      style={[styles.rowTitle, type.sans, { color: colors.ink }]}
                    >
                      {task.title}
                    </Text>
                    {due && due.tone !== "future" && <DueChip due={due} />}
                  </View>
                  {!!task.description && (
                    <Text
                      numberOfLines={1}
                      style={[styles.rowSub, type.sans, { color: colors.inkMuted }]}
                    >
                      {task.description}
                    </Text>
                  )}
                </View>
                {task.checklist.length > 0 && (
                  <View style={styles.rowChecklist}>
                    {task.checklist.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityLabel={item.label}
                        onPress={() => toggleItem(item.id)}
                        style={styles.rowCheckLine}
                      >
                        <Check
                          done={item.done}
                          label={item.label}
                          size={16}
                          onToggle={() => toggleItem(item.id)}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.rowCheckLabel,
                            type.sans,
                            { color: item.done ? colors.inkMuted : colors.ink },
                            item.done && { textDecorationLine: "line-through" },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              {web && (
                <Pressable
                  accessibilityLabel={`Delete "${task.title}"`}
                  hitSlop={10}
                  onPress={() => del.mutate(id)}
                  style={[styles.rowTrash, { opacity: hovered ? 1 : 0 }]}
                >
                  <Trash2 size={14} color={alpha(colors.inkMuted, 0.5)} />
                </Pressable>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function DoneTaskRow({ task }: { task: Task }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  return (
    <Animated.View
      layout={settle}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
    >
      <Pressable style={styles.doneRow} onPress={() => router.push(`/task/${task.id}`)}>
        <Check
          done
          label={`Mark "${task.title}" not done`}
          size={22}
          onToggle={() => update.mutate({ id: task.id, patch: { done_at: "" } })}
        />
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, styles.rowDone, type.sans, { color: colors.inkMuted }]}
        >
          {task.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function DueChip({ due }: { due: { text: string; tone: string } }) {
  const colors = usePalette();
  const type = useType();
  const overdue = due.tone === "overdue";
  const tint = overdue ? colors.clay : colors.zest;
  return (
    <View
      style={[styles.dueChip, { borderColor: alpha(tint, 0.4), backgroundColor: alpha(tint, 0.1) }]}
    >
      <Text style={[styles.dueChipText, type.sansMedium, { color: tint }]}>{due.text}</Text>
    </View>
  );
}

/** Three softly pulsing placeholder lines while the day loads. */
function GhostLines() {
  const colors = usePalette();
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.ghosts}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[styles.ghost, pulseStyle, { backgroundColor: alpha(colors.ink, 0.04) }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: 20,
    paddingTop: 36,
  },
  sheetScroll: {
    flex: 1,
    marginHorizontal: -20,
    marginBottom: -20,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  holesRow: {
    position: "absolute",
    left: BINDING_INSET,
    right: BINDING_INSET,
    top: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  holeSlot: {
    width: 12,
    alignItems: "center",
  },
  hole: {
    height: 10,
    width: 10,
    borderRadius: 999,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headingLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headingTitle: {
    fontSize: 24,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  counter: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  list: {
    marginTop: 4,
  },
  row: {
    position: "absolute",
    left: -8,
    right: -8,
    borderRadius: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  rowClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: "hidden",
  },
  rowCard: {
    flex: 1,
    borderRadius: 14,
  },
  deleteUnder: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_W,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  rowPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingLeft: 12,
    paddingRight: 4,
  },
  rowCheck: {
    height: ROW_H,
    justifyContent: "center",
  },
  rowTrash: {
    height: ROW_H,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMain: {
    height: ROW_H,
    justifyContent: "center",
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
  },
  rowDone: {
    textDecorationLine: "line-through",
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
  },
  rowChecklist: {
    paddingBottom: 8,
  },
  rowCheckLine: {
    height: CHECK_LINE_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  rowCheckLabel: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
  },
  dueChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dueChipText: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  empty: {
    marginTop: 12,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  donePile: {
    marginTop: 20,
  },
  errorBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
  },
  ghosts: {
    marginTop: 12,
    gap: 8,
  },
  ghost: {
    height: 36,
    borderRadius: 12,
  },
});
