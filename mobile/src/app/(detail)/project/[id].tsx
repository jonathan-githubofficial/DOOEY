import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, FileText } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "@/components/Check";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { hueColor, useProgram } from "@/features/learning/api";
import { fontStyle } from "@/features/style/tokens";
import { useProjectTasks, useUpdateTask } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { dateOnly, toLocalNoon } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(420).damping(32);

/** One program's folder, opened: the goal and why, the runway of sessions
 * (ordinary tasks — tick them here or anywhere), and the source files. */
export default function ProjectPage() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: program } = useProgram(id);
  const { data: tasks } = useProjectTasks(id);
  const [reading, setReading] = useState<string | null>(null);

  const open = (tasks ?? []).filter((t) => !t.done_at);
  const done = (tasks ?? []).filter((t) => t.done_at);
  const accent = program ? hueColor(program.hue, colors) : colors.zest;
  const files = Object.keys(program?.files ?? {});

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
      >
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back to Projects"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.inkMuted} />
        </PressableScale>

        {program && (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={[styles.header, { borderLeftColor: alpha(accent, 0.5) }]}>
              <Text style={[styles.goal, type.display, { color: colors.ink }]}>{program.goal}</Text>
              {!!program.why && (
                <Text style={[styles.why, type.sans, { color: colors.inkMuted }]}>
                  {program.why}
                </Text>
              )}
              {tasks && tasks.length > 0 && (
                <Text style={[styles.tally, type.sans, { color: colors.inkMuted }]}>
                  {done.length} of {tasks.length} sessions done
                </Text>
              )}
            </View>

            {open.length > 0 && (
              <Panel style={styles.panel}>
                <Eyebrow>runway</Eyebrow>
                <View style={styles.list}>
                  {open.map((t) => (
                    <SessionRow key={t.id} task={t} />
                  ))}
                </View>
              </Panel>
            )}

            {done.length > 0 && (
              <Panel style={styles.panel}>
                <Eyebrow>done</Eyebrow>
                <View style={styles.list}>
                  {done.map((t) => (
                    <SessionRow key={t.id} task={t} />
                  ))}
                </View>
              </Panel>
            )}

            {files.length > 0 && (
              <Panel style={styles.panel}>
                <Eyebrow>materials</Eyebrow>
                <View style={styles.fileRow}>
                  {files.map((f) => (
                    <PressableScale
                      key={f}
                      scaleTo={0.95}
                      onPress={() => setReading(f)}
                      style={[
                        styles.fileChip,
                        { borderColor: alpha(colors.rule, 0.7), backgroundColor: colors.paper },
                      ]}
                    >
                      <FileText size={13} color={colors.inkMuted} />
                      <Text style={[styles.fileChipText, type.sansMedium, { color: colors.ink }]}>
                        {f}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </Panel>
            )}
          </Animated.View>
        )}
      </ScrollView>

      {/* A source file, readable full-screen. */}
      <Modal visible={!!reading} animationType="slide" onRequestClose={() => setReading(null)}>
        <View style={[styles.reader, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
          <Grain />
          <View style={styles.readerHead}>
            <Text style={[styles.readerTitle, type.display, { color: colors.ink }]}>{reading}</Text>
            <Pressable onPress={() => setReading(null)} hitSlop={8}>
              <Text style={[styles.readerClose, type.sansMedium, { color: colors.zest }]}>done</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.readerBody}>
            <Text style={[styles.readerText, fontStyle("mono", "400"), { color: colors.ink }]}>
              {reading ? program?.files[reading] : ""}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SessionRow({ task }: { task: Task }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  const isDone = !!task.done_at;
  const date = task.due_date
    ? toLocalNoon(dateOnly(task.due_date)).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <Animated.View layout={settle} style={styles.sessionRow}>
      <Check
        done={isDone}
        gate={task.gate}
        label={task.title}
        size={20}
        onToggle={() =>
          update.mutate({
            id: task.id,
            patch: { done_at: isDone ? "" : new Date().toISOString() },
          })
        }
      />
      <Pressable style={styles.sessionBody} onPress={() => router.push(`/task/${task.id}`)}>
        <Text
          numberOfLines={1}
          style={[
            styles.sessionTitle,
            type.sans,
            { color: isDone ? colors.inkMuted : colors.ink },
            isDone && { textDecorationLine: "line-through" },
          ]}
        >
          {task.gate ? "⛳ " : ""}
          {task.title}
        </Text>
        {!!task.description && (
          <Text numberOfLines={1} style={[styles.sessionSub, type.sans, { color: colors.inkMuted }]}>
            {task.description}
          </Text>
        )}
      </Pressable>
      {!!date && (
        <Text style={[styles.sessionDate, type.sans, { color: colors.inkMuted }]}>{date}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  back: {
    height: 40,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  header: { marginTop: 4, borderLeftWidth: 4, paddingLeft: 14, paddingVertical: 2 },
  goal: { fontSize: 26, letterSpacing: -0.5 },
  why: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  tally: { marginTop: 8, fontSize: 12, fontVariant: ["tabular-nums"] },
  panel: { marginTop: 16, padding: 20 },
  list: { marginTop: 6 },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  sessionBody: { flex: 1, minWidth: 0 },
  sessionTitle: { fontSize: 14 },
  sessionSub: { marginTop: 1, fontSize: 12 },
  sessionDate: { fontSize: 11, fontVariant: ["tabular-nums"] },
  fileRow: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  fileChipText: { fontSize: 12 },
  reader: { flex: 1 },
  readerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  readerTitle: { fontSize: 18, letterSpacing: -0.3 },
  readerClose: { fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
  readerBody: { paddingHorizontal: 20, paddingBottom: 40 },
  readerText: { fontSize: 13, lineHeight: 20 },
});
