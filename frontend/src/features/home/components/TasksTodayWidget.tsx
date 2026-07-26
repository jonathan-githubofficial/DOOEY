import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Check } from "@/components/Check";
import { useDayTasks, useUpdateTask } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { dateOnly, localDate } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { openSheet } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { HomeWidget } from "./HomeWidget";

const SHOW = 8;

/** Days a task has been waiting past its due date. 0 = due today or undated. */
function ageDays(due: string): number {
  if (!due) return 0;
  const ms =
    new Date(`${localDate()}T00:00:00`).getTime() -
    new Date(`${dateOnly(due)}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

const SLOTS = [
  { label: "Morning · 9:00", start: 9 * 60 },
  { label: "Midday · 12:00", start: 12 * 60 },
  { label: "Afternoon · 3:00", start: 15 * 60 },
  { label: "Evening · 6:00", start: 18 * 60 },
];

/** Today's open tasks, actionable in place: tick the box to finish, tap to
 * open, hold to drop it onto today's timeline. Overdue tasks surface here by
 * themselves (the day query has no lower bound) wearing their age. */
export function TasksTodayWidget() {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: tasks = [] } = useDayTasks(localDate());
  const update = useUpdateTask();

  const open = tasks.filter((t) => !t.done_at);
  const shown = open.slice(0, SHOW);

  const timebox = (task: Task) =>
    openSheet({
      title: task.title,
      actions: [
        ...SLOTS.map((s) => ({
          label: s.label,
          onPress: () =>
            update.mutate({
              id: task.id,
              patch: { start_min: s.start, dur_min: task.dur_min || 60 },
            }),
        })),
        ...(task.start_min > 0
          ? [
              {
                label: "Unschedule",
                destructive: true,
                onPress: () => update.mutate({ id: task.id, patch: { start_min: 0 } }),
              },
            ]
          : []),
      ],
    });

  return (
    <HomeWidget title="tasks">
      {open.length === 0 && (
        <Text style={[type.sans, styles.empty, { color: colors.inkMuted }]}>
          All clear — nothing waiting today.
        </Text>
      )}
      {shown.map((task) => {
        const age = ageDays(task.due_date);
        return (
          <Animated.View key={task.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })}
              onLongPress={() => timebox(task)}
            >
              <Check
                done={false}
                label={task.title}
                onToggle={() =>
                  update.mutate({ id: task.id, patch: { done_at: new Date().toISOString() } })
                }
              />
              <Text numberOfLines={1} style={[type.sans, styles.title, { color: colors.ink }]}>
                {task.title}
              </Text>
              {age > 0 && (
                <View style={[styles.age, { backgroundColor: alpha(colors.clay, 0.15) }]}>
                  <Text style={[type.sansMedium, styles.ageText, { color: colors.clay }]}>
                    {age}d
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        );
      })}
      {open.length > SHOW && (
        <Pressable onPress={() => router.push("/planner")}>
          <Text style={[type.sansMedium, styles.more, { color: colors.inkMuted }]}>
            +{open.length - SHOW} more in Planner
          </Text>
        </Pressable>
      )}
    </HomeWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  title: { flex: 1, fontSize: 15 },
  // A pill like AgendaSheet's DueChip — fully-round chips are shape, not a
  // card radius, so the Style slider rightly doesn't own them.
  age: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  ageText: { fontSize: 11 },
  empty: { fontSize: 14, paddingVertical: 4 },
  more: { fontSize: 13, paddingTop: 6 },
});
