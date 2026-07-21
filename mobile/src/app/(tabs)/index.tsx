import { Circle, CircleCheck, Plus } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOut,
  LinearTransition,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { useCreateTask, useDayTasks, useDeleteTask, useUpdateTask } from "@/features/tasks/api";
import { WeekStrip } from "@/features/tasks/components/WeekStrip";
import type { Task } from "@/features/tasks/types";
import { dayTitle, dueInfo, localDate, toLocalNoon, toPbDate } from "@/lib/dates";
import { alpha, fonts } from "@/lib/theme";
import { usePalette } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(380).damping(32);

/** The planner: one day at a glance — pick a day on the week ribbon, check
 * things off, add the next one at the bottom. Switching days slides the sheet
 * in from the side you're paging toward, desk-calendar style. */
export default function Planner() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const { data: tasks } = useDayTasks(selected);

  const select = (date: string) => {
    if (date === selected) return;
    setDirection(date > selected ? 1 : -1);
    setSelected(date);
  };

  const open = (tasks ?? []).filter((t) => !t.done_at);
  const done = (tasks ?? []).filter((t) => t.done_at);
  const dateStamp = toLocalNoon(selected).toLocaleDateString("en", {
    month: "long",
    day: "numeric",
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}
    >
      <Grain />
      <View style={styles.strip}>
        <Panel style={styles.stripPanel}>
          <WeekStrip selected={selected} onSelect={select} />
        </Panel>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          key={selected}
          entering={(direction === 1 ? FadeInRight : FadeInLeft).duration(220)}
        >
          <View style={styles.dayHead}>
            <Text style={[styles.dayTitle, { color: colors.ink }]}>{dayTitle(selected)}</Text>
            <Text style={[styles.dayStamp, { color: colors.inkMuted }]}>{dateStamp}</Text>
          </View>

          {open.length === 0 && done.length === 0 && (
            <Text style={[styles.empty, { color: colors.inkMuted }]}>
              Nothing here yet — add the first thing below.
            </Text>
          )}

          {open.map((t) => (
            <TaskRow key={t.id} task={t} selectedDate={selected} />
          ))}

          {done.length > 0 && (
            <Animated.View layout={settle}>
              <Eyebrow style={styles.doneLabel}>done</Eyebrow>
            </Animated.View>
          )}
          {done.map((t) => (
            <TaskRow key={t.id} task={t} selectedDate={selected} />
          ))}
        </Animated.View>
      </ScrollView>

      <Composer date={selected} bottomInset={insets.bottom} />
    </KeyboardAvoidingView>
  );
}

function TaskRow({ task, selectedDate }: { task: Task; selectedDate: string }) {
  const colors = usePalette();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const isDone = !!task.done_at;
  // Overdue/undated chips only matter on today's carried-over list.
  const due = !isDone && selectedDate === localDate() && task.due_date ? dueInfo(task.due_date) : null;

  return (
    <Animated.View layout={settle} exiting={FadeOut.duration(150)}>
      <Pressable
        onLongPress={() =>
          Alert.alert("Delete task", `Delete "${task.title}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => del.mutate(task.id) },
          ])
        }
        style={styles.row}
      >
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel={isDone ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
          onPress={() =>
            update.mutate({
              id: task.id,
              patch: { done_at: isDone ? "" : new Date().toISOString() },
            })
          }
          hitSlop={8}
        >
          {/* Re-keying on state pops the tick in on a spring — the completion
              celebrates small. */}
          <Animated.View key={String(isDone)} entering={ZoomIn.springify().stiffness(420).damping(18)}>
            {isDone ? (
              <CircleCheck size={22} color={colors.leaf} />
            ) : (
              <Circle size={22} color={alpha(colors.inkMuted, 0.5)} />
            )}
          </Animated.View>
        </PressableScale>
        <View style={styles.rowBody}>
          <Text
            style={[
              styles.rowTitle,
              { color: isDone ? colors.inkMuted : colors.ink },
              isDone && styles.rowTitleDone,
            ]}
          >
            {task.title}
          </Text>
          {!!task.description && (
            <Text style={[styles.rowSub, { color: colors.inkMuted }]} numberOfLines={1}>
              {task.description}
            </Text>
          )}
        </View>
        {due && due.tone === "overdue" && (
          <Text style={[styles.dueChip, { color: colors.clay }]}>{due.text}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Quick-add with minimum friction: type, hit return, keep going. */
function Composer({ date, bottomInset }: { date: string; bottomInset: number }) {
  const colors = usePalette();
  const create = useCreateTask();
  const [title, setTitle] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    create.mutate({ title: trimmed, due_date: toPbDate(date) });
    setTitle("");
  };

  return (
    <View style={[styles.composer, { paddingBottom: bottomInset > 0 ? 4 : 12 }]}>
      <Panel style={styles.composerPanel}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={submit}
          placeholder={`Add a task for ${dayTitle(date).toLowerCase()}`}
          placeholderTextColor={colors.inkMuted}
          returnKeyType="done"
          submitBehavior="submit"
          style={[styles.composerInput, { color: colors.ink }]}
        />
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Add task"
          onPress={submit}
          disabled={!title.trim()}
          style={[
            styles.composerAdd,
            { backgroundColor: alpha(colors.zest, 0.15) },
            !title.trim() && { opacity: 0.4 },
          ]}
        >
          <Plus size={18} color={colors.zest} />
        </PressableScale>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  strip: {
    paddingHorizontal: 16,
  },
  stripPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  dayHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 12,
  },
  dayTitle: {
    fontFamily: fonts.displayBlack,
    fontSize: 34,
    letterSpacing: -0.8,
  },
  dayStamp: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 16,
  },
  rowTitleDone: {
    textDecorationLine: "line-through",
  },
  rowSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    marginTop: 1,
  },
  dueChip: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
  },
  doneLabel: {
    marginTop: 20,
    marginBottom: 4,
  },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  composerPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  composerInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 15,
    paddingVertical: 6,
  },
  composerAdd: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
});
