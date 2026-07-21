import { useRouter } from "expo-router";
import { ChevronRight, Play, Plus } from "lucide-react-native";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { fontStyle } from "@/features/style/tokens";
import {
  useDeleteWorkout,
  useRoutines,
  useSaveRoutine,
  useStartWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { useWorkoutPrefs } from "@/features/workouts/store";
import {
  formatElapsed,
  workoutSetsDone,
  workoutVolume,
  type Routine,
  type Workout,
} from "@/features/workouts/types";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The gym space: the live session (if one is running), routines to start
 * from, and the training log so far. */
export default function Gym() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: routines } = useRoutines();
  const { data: workouts, isPending } = useWorkouts();
  const saveRoutine = useSaveRoutine();
  const start = useStartWorkout();

  const live = workouts?.find((w) => !w.ended_at) ?? null;
  const history = (workouts ?? []).filter((w) => w.ended_at);

  const openWorkout = (wid: string) =>
    router.push({ pathname: "/workout/[id]", params: { id: wid } });

  const startWorkout = (routine: Routine | null) => {
    // One session at a time — a running workout resumes instead.
    if (live) return openWorkout(live.id);
    start.mutate(routine, { onSuccess: (w) => openWorkout(w.id) });
  };

  const newRoutine = () =>
    saveRoutine.mutate(
      { name: "New routine", items: [], position: routines?.length ?? 0 },
      { onSuccess: (r) => router.push({ pathname: "/routine/[id]", params: { id: r.id } }) },
    );

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
        <Masthead avatar={<PageDoodle page="gym" />} title="Gym">
          <UnitPill />
        </Masthead>

        {live && <LiveBanner workout={live} onPress={() => openWorkout(live.id)} />}

        {!live && (
          <PressableScale
            scaleTo={0.97}
            accessibilityLabel="Start an empty workout"
            onPress={() => startWorkout(null)}
            disabled={start.isPending}
            style={[styles.startEmpty, { borderColor: alpha(colors.rule, 0.8) }]}
          >
            <Play size={15} color={colors.zest} />
            <Text style={[styles.startEmptyText, type.sansMedium, { color: colors.ink }]}>
              Start an empty workout
            </Text>
          </PressableScale>
        )}

        <Eyebrow style={styles.section}>routines</Eyebrow>
        <View style={styles.cards}>
          {(routines ?? []).map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <RoutineCard routine={r} onStart={() => startWorkout(r)} />
            </Animated.View>
          ))}
          <PressableScale
            scaleTo={0.97}
            accessibilityLabel="New routine"
            onPress={newRoutine}
            disabled={saveRoutine.isPending}
            style={[styles.newTile, { borderColor: alpha(colors.rule, 0.8) }]}
          >
            <Plus size={16} color={colors.inkMuted} />
            <Text style={[styles.newTileText, type.sansMedium, { color: colors.inkMuted }]}>
              New routine
            </Text>
          </PressableScale>
        </View>

        <Eyebrow style={styles.section}>log</Eyebrow>
        <View style={styles.cards}>
          {history.map((w) => (
            <HistoryRow key={w.id} workout={w} onPress={() => openWorkout(w.id)} />
          ))}
          {!isPending && history.length === 0 && (
            <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
              No sessions yet — start one and the log builds itself.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** lbs ⇄ kg, worn on the masthead. */
function UnitPill() {
  const colors = usePalette();
  const type = useType();
  const unit = useWorkoutPrefs((s) => s.unit);
  const setUnit = useWorkoutPrefs((s) => s.setUnit);
  return (
    <PressableScale
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={`Weights in ${unit} — tap to switch`}
      onPress={() => {
        hapticTap();
        setUnit(unit === "lbs" ? "kg" : "lbs");
      }}
      style={[styles.unitPill, { borderColor: alpha(colors.rule, 0.9) }]}
    >
      <Text style={[styles.unitText, type.sansMedium, { color: colors.inkMuted }]}>{unit}</Text>
    </PressableScale>
  );
}

/** The running session — elapsed ticking, one tap back into it. */
function LiveBanner({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const colors = usePalette();
  const type = useType();
  const now = useNow();
  return (
    <PressableScale scaleTo={0.98} accessibilityLabel="Resume workout" onPress={onPress}>
      <Panel style={[styles.liveBanner, { borderColor: alpha(colors.zest, 0.5) }]}>
        <View style={[styles.liveDot, { backgroundColor: colors.zest }]} />
        <View style={styles.liveText}>
          <Text style={[styles.liveTitle, type.sansSemiBold, { color: colors.ink }]}>
            {workout.title}
          </Text>
          <Text style={[styles.liveSub, type.sans, { color: colors.inkMuted }]}>
            in progress — tap to resume
          </Text>
        </View>
        <Text style={[styles.liveClock, fontStyle("fraunces", "700"), { color: colors.zest }]}>
          {formatElapsed(now - new Date(workout.started_at).getTime())}
        </Text>
      </Panel>
    </PressableScale>
  );
}

function RoutineCard({ routine, onStart }: { routine: Routine; onStart: () => void }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const summary =
    routine.items.length === 0
      ? "no exercises yet"
      : routine.items.map((i) => i.name).join(" · ");
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityLabel={`Edit routine ${routine.name}`}
      onPress={() => router.push({ pathname: "/routine/[id]", params: { id: routine.id } })}
    >
      <Panel style={styles.routineCard}>
        <View style={styles.routineText}>
          <Text numberOfLines={1} style={[styles.routineName, type.display, { color: colors.ink }]}>
            {routine.name}
          </Text>
          <Text numberOfLines={2} style={[styles.routineSummary, type.sans, { color: colors.inkMuted }]}>
            {summary}
          </Text>
        </View>
        <PressableScale
          scaleTo={0.88}
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          onPress={onStart}
          style={[styles.routineStart, { backgroundColor: alpha(colors.zest, 0.14) }]}
        >
          <Play size={14} color={colors.zest} />
        </PressableScale>
      </Panel>
    </PressableScale>
  );
}

/** One finished session in the log — date, duration, sets and volume. */
function HistoryRow({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const colors = usePalette();
  const type = useType();
  const unit = useWorkoutPrefs((s) => s.unit);
  const del = useDeleteWorkout();
  const started = new Date(workout.started_at);
  const dur = formatElapsed(new Date(workout.ended_at).getTime() - started.getTime());
  const volume = workoutVolume(workout.entries);
  const day = started.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <Pressable
      accessibilityLabel={`${workout.title}, ${day}`}
      onPress={onPress}
      onLongPress={() =>
        Alert.alert("Delete this session?", `${workout.title} — ${day}`, [
          { text: "Keep it", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => del.mutate(workout.id) },
        ])
      }
    >
      <Panel style={styles.historyRow}>
        <View style={styles.historyText}>
          <Text numberOfLines={1} style={[styles.historyTitle, type.sansSemiBold, { color: colors.ink }]}>
            {workout.title}
          </Text>
          <Text style={[styles.historySub, type.sans, { color: colors.inkMuted }]}>
            {day} · {dur} · {workoutSetsDone(workout.entries)} sets
            {volume > 0 ? ` · ${Math.round(volume).toLocaleString()} ${unit}` : ""}
          </Text>
        </View>
        <ChevronRight size={15} color={colors.inkMuted} />
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  unitPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  unitText: {
    fontSize: 12,
    letterSpacing: 0.6,
  },
  startEmpty: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 14,
  },
  startEmptyText: {
    fontSize: 13.5,
  },
  liveBanner: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
  },
  liveDot: {
    height: 8,
    width: 8,
    borderRadius: 999,
  },
  liveText: {
    flex: 1,
    minWidth: 0,
  },
  liveTitle: {
    fontSize: 15,
  },
  liveSub: {
    marginTop: 1,
    fontSize: 12,
  },
  liveClock: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  section: {
    marginTop: 24,
  },
  cards: {
    marginTop: 10,
    gap: 10,
  },
  newTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newTileText: {
    fontSize: 13,
  },
  routineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routineText: {
    flex: 1,
    minWidth: 0,
  },
  routineName: {
    fontSize: 17,
  },
  routineSummary: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
  routineStart: {
    height: 40,
    width: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  historyText: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    fontSize: 14.5,
  },
  historySub: {
    marginTop: 2,
    fontSize: 12,
  },
  empty: {
    fontSize: 12.5,
    textAlign: "center",
    paddingVertical: 12,
  },
});
