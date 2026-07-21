import { useEffect } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
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

/** One planner page: the day's open tasks, quick facts, and the day's done
 * pile. Long-press a row to delete it (the mobile stand-in for the web's
 * hover-revealed trash). */
export function AgendaSheet({ date }: { date: string }) {
  const colors = usePalette();
  const { data: tasks, isPending, error } = useDayTasks(date);

  const open = (tasks ?? []).filter((t) => !t.done_at);
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
        <View style={[styles.errorBox, { borderColor: alpha(colors.clay, 0.4), backgroundColor: alpha(colors.clay, 0.1) }]}>
          <Text style={[styles.errorText, { color: colors.ink }]}>
            Couldn't load this day. {error.message}
          </Text>
        </View>
      )}
      {isPending && !error && <GhostLines />}

      {tasks && (
        <>
          <View style={styles.list}>
            {open.map((t, i) => (
              <TaskRow key={t.id} task={t} date={date} first={i === 0} />
            ))}
          </View>

          {open.length === 0 && done.length === 0 && (
            <Text style={[styles.empty, { color: colors.inkMuted }]}>
              Nothing planned — the day is yours.
            </Text>
          )}

          {done.length > 0 && (
            <Animated.View layout={settle} style={styles.donePile}>
              <Eyebrow>done</Eyebrow>
              {done.map((t, i) => (
                <DoneTaskRow key={t.id} task={t} first={i === 0} />
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
function SheetHeading({ date, count }: { date: string; count: number }) {
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

function TaskRow({ task, date, first }: { task: Task; date: string; first: boolean }) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const due = date === localDate() && task.due_date ? dueInfo(task.due_date) : null;

  return (
    <Animated.View
      layout={settle}
      exiting={FadeOut.duration(150)}
      style={[!first && { borderTopWidth: 1, borderTopColor: alpha(colors.rule, 0.5) }]}
    >
      <Pressable
        onLongPress={() =>
          Alert.alert("Delete task", `Delete "${task.title}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => del.mutate(task.id) },
          ])
        }
        style={styles.row}
      >
        <Check
          done={false}
          label={`Mark "${task.title}" done`}
          size={22}
          onToggle={() =>
            update.mutate({ id: task.id, patch: { done_at: new Date().toISOString() } })
          }
        />
        <View style={styles.rowBody}>
          <View style={styles.rowTitleLine}>
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
        </View>
      </Pressable>
    </Animated.View>
  );
}

function DoneTaskRow({ task, first }: { task: Task; first: boolean }) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  return (
    <Animated.View
      layout={settle}
      exiting={FadeOut.duration(150)}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: alpha(colors.rule, 0.5) }]}
    >
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
      style={[
        styles.dueChip,
        { borderColor: alpha(tint, 0.4), backgroundColor: alpha(tint, 0.1) },
      ]}
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
  row: {
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
    gap: 10,
  },
  rowTitle: {
    flex: 1,
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
