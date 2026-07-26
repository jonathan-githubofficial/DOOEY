import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useDayTasks } from "@/features/tasks/api";
import { fmtMin } from "@/features/tasks/timeGrid";
import { useLiveWorkout } from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { localDate } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { HomeWidget } from "./HomeWidget";

/** Today's timeboxes in one glance, with a zest rule marking now. External
 * calendar events will join this list when sync lands — the row model
 * (time + title) is already theirs. */
export function ScheduleWidget() {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: tasks = [] } = useDayTasks(localDate());
  const live = useLiveWorkout();
  const now = new Date(useNow(30_000));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const scheduled = tasks
    .filter((t) => !t.done_at && t.start_min > 0)
    .sort((a, b) => a.start_min - b.start_min);

  let nowDrawn = false;
  return (
    <HomeWidget title="schedule">
      {scheduled.length === 0 && !live && (
        <Pressable onPress={() => router.push("/planner")}>
          <Text style={[type.sans, styles.empty, { color: colors.inkMuted }]}>
            Nothing timeboxed — plan the day in Planner.
          </Text>
        </Pressable>
      )}
      {scheduled.map((t) => {
        const past = t.start_min + (t.dur_min || 60) < nowMin;
        const rule = !nowDrawn && t.start_min >= nowMin;
        if (rule) nowDrawn = true;
        return (
          <Fragment key={t.id}>
            {rule && <View style={[styles.nowRule, { backgroundColor: colors.zest }]} />}
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
              <Pressable
                style={styles.row}
                onPress={() => router.push({ pathname: "/task/[id]", params: { id: t.id } })}
              >
                <Text
                  style={[
                    type.sansMedium,
                    styles.time,
                    { color: past ? colors.inkMuted : colors.zest },
                  ]}
                >
                  {fmtMin(t.start_min)}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[type.sans, styles.title, { color: past ? colors.inkMuted : colors.ink }]}
                >
                  {t.title}
                </Text>
              </Pressable>
            </Animated.View>
          </Fragment>
        );
      })}
      {scheduled.length > 0 && !nowDrawn && (
        <View style={[styles.nowRule, { backgroundColor: colors.zest }]} />
      )}
      {live && (
        <Pressable
          style={[styles.liveRow, { backgroundColor: alpha(colors.zest, 0.12) }]}
          onPress={() => router.push({ pathname: "/workout/[id]", params: { id: live.id } })}
        >
          <Text style={[type.sansMedium, styles.liveText, { color: colors.zest }]}>
            Gym session live — {live.title}
          </Text>
        </Pressable>
      )}
    </HomeWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  time: { fontSize: 13, width: 52, textAlign: "right" },
  title: { flex: 1, fontSize: 15 },
  nowRule: { height: 2, borderRadius: 1, marginVertical: 2 },
  liveRow: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
  liveText: { fontSize: 13 },
  empty: { fontSize: 14, paddingVertical: 4 },
});
