import { useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Check } from "@/components/Check";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { dayTitle, dueInfo, localDate, toLocalNoon } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDayTasks, useDeleteTask, useUpdateTask } from "../api";
import type { Task } from "../types";
import { BINDING_INSET, RING_COUNT } from "./PlannerBook";

const settle = LinearTransition.springify().stiffness(420).damping(32);
const ROW_H = 56;
const DAY_MS = 86_400_000;
const LIFT = { stiffness: 420, damping: 34 };

/** One planner page: the day's open tasks in a hold-to-drag reorderable list,
 * and the day's done pile. Rows open the task's page. */
export function AgendaSheet({ date }: { date: string }) {
  const colors = usePalette();
  const type = useType();
  const { data: tasks, isPending, error } = useDayTasks(date);

  const open = useMemo(() => (tasks ?? []).filter((t) => !t.done_at), [tasks]);
  const done = (tasks ?? []).filter((t) => t.done_at);

  return (
    <Panel style={styles.sheet}>
      {/* Punched holes — same slot geometry as the binder rings, so the wire
          lands dead-center in each hole. */}
      <View pointerEvents="none" style={styles.holesRow}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <View key={i} style={styles.holeSlot}>
            <View style={[styles.hole, { backgroundColor: alpha(colors.ink, 0.18) }]} />
          </View>
        ))}
      </View>

      <SheetHeading date={date} count={open.length} />

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
    </Panel>
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
 * exactly like the web planner. */
function ReorderableRows({ rows, date }: { rows: Task[]; date: string }) {
  const colors = usePalette();
  const update = useUpdateTask();
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(rows.map((r, i) => [r.id, i])),
  );

  // Re-sync slots whenever the server list changes (adds, deletes, check-offs).
  const signature = rows.map((r) => r.id).join("|");
  useEffect(() => {
    positions.value = Object.fromEntries(rows.map((r, i) => [r.id, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

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

  return (
    <View style={[styles.list, { height: rows.length * ROW_H }]}>
      {/* Hairlines live at the slot boundaries, not on the rows — they hold
          still while rows glide between slots. */}
      {rows.length > 1 &&
        Array.from({ length: rows.length - 1 }).map((_, i) => (
          <View
            key={i}
            pointerEvents="none"
            style={[
              styles.separator,
              { top: (i + 1) * ROW_H, backgroundColor: alpha(colors.rule, 0.5) },
            ]}
          />
        ))}
      {rows.map((t, i) => (
        <DraggableRow
          key={t.id}
          task={t}
          index={i}
          count={rows.length}
          date={date}
          positions={positions}
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
  onDrop,
}: {
  task: Task;
  index: number;
  count: number;
  date: string;
  positions: SharedValue<Record<string, number>>;
  onDrop: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const id = task.id;

  const dragging = useSharedValue(false);
  const y = useSharedValue(index * ROW_H);
  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      dragging.value = true;
      startY.value = (positions.value[id] ?? index) * ROW_H;
      y.value = startY.value;
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      const newIdx = Math.max(0, Math.min(count - 1, Math.round(y.value / ROW_H)));
      const curIdx = positions.value[id];
      if (newIdx !== curIdx) {
        const next = { ...positions.value };
        for (const k in next) if (k !== id && next[k] === newIdx) next[k] = curIdx;
        next[id] = newIdx;
        positions.value = next;
      }
    })
    .onFinalize(() => {
      dragging.value = false;
      runOnJS(onDrop)(id);
    });

  // The row is bare paper until it's lifted — only a live drag earns the
  // card treatment (surface fill, shadow, slight grow), like the web.
  const surface = colors.surface;
  const rowStyle = useAnimatedStyle(() => {
    const idx = positions.value[id] ?? index;
    return dragging.value
      ? {
          top: y.value,
          zIndex: 20,
          backgroundColor: surface,
          shadowOpacity: 0.18,
          elevation: 6,
          transform: [{ scale: 1.02 }],
        }
      : {
          top: withSpring(idx * ROW_H, LIFT),
          zIndex: 0,
          backgroundColor: "transparent",
          shadowOpacity: 0,
          elevation: 0,
          transform: [{ scale: withSpring(1, LIFT) }],
        };
  });

  const due = date === localDate() && task.due_date ? dueInfo(task.due_date) : null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={[styles.row, rowStyle, { shadowColor: "#282018" }]}
      >
        <Check
          done={false}
          gate={task.gate}
          label={`Mark "${task.title}" done`}
          size={22}
          onToggle={() =>
            update.mutate({ id, patch: { done_at: new Date().toISOString() } })
          }
        />
        <Pressable style={styles.rowBody} onPress={() => router.push(`/task/${id}`)}>
          <View style={styles.rowTitleLine}>
            {task.gate && <Text style={{ color: colors.zest }}>⛳</Text>}
            <Text numberOfLines={1} style={[styles.rowTitle, type.sans, { color: colors.ink }]}>
              {task.title}
            </Text>
            {due && due.tone !== "future" && <DueChip due={due} />}
          </View>
          {!!task.description && (
            <Text numberOfLines={1} style={[styles.rowSub, type.sans, { color: colors.inkMuted }]}>
              {task.description}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel={`Delete "${task.title}"`}
          hitSlop={8}
          onPress={() =>
            Alert.alert("Delete task", `Delete "${task.title}"?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => del.mutate(id) },
            ])
          }
        >
          <Trash2 size={14} color={alpha(colors.inkMuted, 0.35)} />
        </Pressable>
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
      style={styles.doneRow}
    >
      <Check
        done
        label={`Mark "${task.title}" not done`}
        size={22}
        onToggle={() => update.mutate({ id: task.id, patch: { done_at: "" } })}
      />
      <Pressable style={styles.rowBody} onPress={() => router.push(`/task/${task.id}`)}>
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
  holesRow: {
    position: "absolute",
    left: BINDING_INSET,
    right: BINDING_INSET,
    top: 9,
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
  separator: {
    position: "absolute",
    left: -8,
    right: -8,
    height: StyleSheet.hairlineWidth,
  },
  row: {
    position: "absolute",
    left: -8,
    right: -8,
    height: ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
