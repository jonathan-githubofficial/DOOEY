import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Check } from "@/components/Check";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { useTasksByTag, useUpdateTask } from "@/features/tasks/api";
import { TagChips } from "@/features/tasks/components/TagChips";
import { RESERVED_TAGS } from "@/features/tasks/tags";
import type { Task } from "@/features/tasks/types";
import { dateOnly, dayTitle } from "@/lib/dates";
import { settle } from "@/lib/motion";
import { usePagePadding } from "@/lib/shell";
import { usePalette, useType } from "@/stores/theme";

/** Everything carrying one tag.
 *
 * This is what a tag is *for*, and why tapping one follows it rather than
 * taking it off. It cuts across days, which no planner view does: `#school`
 * here is the whole of school, whenever it falls. Open work first, then what's
 * behind you. */
export default function TagPage() {
  const colors = usePalette();
  const type = useType();
  const page = usePagePadding();
  const router = useRouter();
  const { tag = "" } = useLocalSearchParams<{ tag: string }>();
  const { data: tasks, isPending } = useTasksByTag(tag);

  const open = (tasks ?? []).filter((t) => !t.done_at);
  const done = (tasks ?? []).filter((t) => t.done_at);
  const reserved = RESERVED_TAGS.find((r) => r.tag === tag);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      <View style={styles.head}>
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.inkMuted} />
        </PressableScale>
        <Masthead title={tag} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: page.paddingBottom }]}
      >
        <View style={styles.summary}>
          <Stamp rotate={-3} color={colors.sky}>
            {open.length} open
          </Stamp>
          {/* The app's own tags mean something beyond grouping — say what. */}
          <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
            {reserved ? reserved.hint : `${tasks?.length ?? 0} tagged in all`}
          </Text>
        </View>

        {!isPending && (tasks?.length ?? 0) === 0 && (
          <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
            Nothing carries this tag yet.
          </Text>
        )}

        {open.map((task) => (
          <TagTaskRow key={task.id} task={task} tag={tag} />
        ))}

        {done.length > 0 && (
          <Animated.View layout={settle()} style={styles.donePile}>
            <Eyebrow>done</Eyebrow>
            {done.map((task) => (
              <TagTaskRow key={task.id} task={task} tag={tag} />
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

/** One task, with the day it belongs to — the thing the planner can't tell you
 * because the planner is already standing on one day. */
function TagTaskRow({ task, tag }: { task: Task; tag: string }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  const isDone = !!task.done_at;

  return (
    <Animated.View layout={settle()} entering={FadeIn.duration(160)}>
      <PressableScale
        scaleTo={0.99}
        accessibilityLabel={`Open ${task.title}`}
        onPress={() => router.push(`/task/${task.id}`)}
      >
        <Panel style={styles.row}>
          <Check
            done={isDone}
            label={`Mark "${task.title}" ${isDone ? "not done" : "done"}`}
            size={22}
            onToggle={() =>
              update.mutate({
                id: task.id,
                patch: { done_at: isDone ? "" : new Date().toISOString() },
              })
            }
          />
          <View style={styles.rowBody}>
            <Text
              numberOfLines={1}
              style={[
                styles.rowTitle,
                type.sans,
                { color: isDone ? colors.inkMuted : colors.ink },
                isDone && styles.struck,
              ]}
            >
              {task.title}
            </Text>
            <View style={styles.rowMeta}>
              {!!task.due_date && (
                <Text style={[styles.rowWhen, type.sansMedium, { color: colors.inkMuted }]}>
                  {dayTitle(dateOnly(task.due_date))}
                </Text>
              )}
              {/* Its other tags, inert here: you are already standing in
                  this one, and hopping sideways mid-list reads as a slip. */}
              <TagChips tags={task.tags.filter((t) => t !== tag)} compact />
            </View>
          </View>
        </Panel>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 2 },
  back: { height: 40, width: 36, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 6, gap: 8 },
  summary: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 6 },
  hint: { fontSize: 12.5 },
  empty: { marginTop: 12, paddingHorizontal: 4, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15 },
  struck: { textDecorationLine: "line-through" },
  rowMeta: { marginTop: 3, flexDirection: "row", alignItems: "center", gap: 8 },
  rowWhen: { fontSize: 11, letterSpacing: 0.3, textTransform: "uppercase" },
  donePile: { marginTop: 18, gap: 8 },
});
