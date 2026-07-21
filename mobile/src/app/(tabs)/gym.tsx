import { useRouter } from "expo-router";
import { BookOpen, ChevronRight, ClipboardList, Play, Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { fontStyle } from "@/features/style/tokens";
import {
  useDeleteRoutine,
  useDeleteWorkout,
  useRoutines,
  useSaveRoutine,
  useStartWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import { exerciseGif, libraryExercise } from "@/features/workouts/library";
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

/** The gym space, laid out the Hevy way: quick start on top, then routines
 * (new + explore, grouped under their plans, each with its own start button),
 * then the training log. */
export default function Gym() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: routines } = useRoutines();
  const { data: workouts, isPending } = useWorkouts();
  const saveRoutine = useSaveRoutine();
  const start = useStartWorkout();
  const [exploring, setExploring] = useState(false);

  const live = workouts?.find((w) => !w.ended_at) ?? null;
  const history = (workouts ?? []).filter((w) => w.ended_at);
  const plans = [...new Set((routines ?? []).map((r) => r.group).filter(Boolean))];
  const loose = (routines ?? []).filter((r) => !r.group);
  const fresh = !isPending && (routines ?? []).length === 0 && history.length === 0 && !live;

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

        <Eyebrow style={styles.section}>quick start</Eyebrow>
        {live ? (
          <LiveBanner workout={live} onPress={() => openWorkout(live.id)} />
        ) : (
          <PressableScale
            scaleTo={0.97}
            accessibilityLabel="Start an empty workout"
            onPress={() => startWorkout(null)}
            disabled={start.isPending}
            style={[styles.quickStart, { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) }]}
          >
            <Plus size={15} color={colors.zest} />
            <Text style={[styles.quickStartText, type.sansMedium, { color: colors.ink }]}>
              Start empty workout
            </Text>
          </PressableScale>
        )}

        <Eyebrow style={styles.section}>routines</Eyebrow>
        <View style={styles.toolRow}>
          <ToolButton
            label="New routine"
            icon={<ClipboardList size={15} color={colors.inkMuted} />}
            onPress={newRoutine}
            disabled={saveRoutine.isPending}
          />
          <ToolButton
            label="Explore"
            icon={<BookOpen size={15} color={colors.inkMuted} />}
            onPress={() => setExploring(true)}
          />
        </View>

        {fresh && (
          <Panel style={styles.freshPanel}>
            <Text style={[styles.freshTitle, fontStyle("fraunces", "900"), { color: colors.ink }]}>
              First day at the gym.
            </Text>
            <Text style={[styles.freshBody, type.sans, { color: colors.inkMuted }]}>
              Build a routine from 1,500 demonstrated exercises — or just start an empty workout
              and log as you go. Your last numbers follow you into every next session.
            </Text>
          </Panel>
        )}

        {plans.map((plan) => (
          <View key={plan}>
            <Text style={[styles.planHead, type.sansSemiBold, { color: colors.ink }]}>{plan}</Text>
            <View style={styles.cards}>
              {(routines ?? [])
                .filter((r) => r.group === plan)
                .map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(220)}>
                    <RoutineCard routine={r} onStart={() => startWorkout(r)} />
                  </Animated.View>
                ))}
            </View>
          </View>
        ))}

        {loose.length > 0 && (
          <>
            {plans.length > 0 && (
              <Text style={[styles.planHead, type.sansSemiBold, { color: colors.ink }]}>
                My routines
              </Text>
            )}
            <View style={[styles.cards, plans.length === 0 && styles.cardsBare]}>
              {loose.map((r, i) => (
                <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(220)}>
                  <RoutineCard routine={r} onStart={() => startWorkout(r)} />
                </Animated.View>
              ))}
            </View>
          </>
        )}

        {history.length > 0 && (
          <>
            <Eyebrow style={styles.section}>log</Eyebrow>
            <View style={styles.cards}>
              {history.map((w) => (
                <HistoryRow key={w.id} workout={w} onPress={() => openWorkout(w.id)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Explore: the library as pure reference — tap an exercise for its
          how-to; nothing gets added from here. */}
      <ExercisePicker visible={exploring} onClose={() => setExploring(false)} />
    </View>
  );
}

function ToolButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.toolBtn, { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) }]}
    >
      {icon}
      <Text style={[styles.toolLabel, type.sansMedium, { color: colors.ink }]}>{label}</Text>
    </PressableScale>
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

/** A routine the Hevy way: name and summary up top, demo loops fanned like
 * board pieces, and a full-width start button. Long-press deletes. */
function RoutineCard({ routine, onStart }: { routine: Routine; onStart: () => void }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const del = useDeleteRoutine();
  const summary =
    routine.items.length === 0
      ? "no exercises yet — tap to build"
      : routine.items.map((i) => i.name).join(", ");
  const gifs = routine.items
    .map((i) => libraryExercise(i.libId))
    .filter((e) => !!e)
    .slice(0, 3);
  return (
    <Pressable
      accessibilityLabel={`Routine ${routine.name}`}
      onPress={() => router.push({ pathname: "/routine/[id]", params: { id: routine.id } })}
      onLongPress={() =>
        Alert.alert("Delete this routine?", routine.name, [
          { text: "Keep it", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => del.mutate(routine.id) },
        ])
      }
    >
      <Panel style={styles.routineCard}>
        <View style={styles.routineTop}>
          <View style={styles.routineText}>
            <Text numberOfLines={1} style={[styles.routineName, type.display, { color: colors.ink }]}>
              {routine.name}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.routineSummary, type.sans, { color: colors.inkMuted }]}
            >
              {summary}
            </Text>
          </View>
          {gifs.length > 0 && (
            <View style={styles.fan}>
              {gifs.map((ex, i) => (
                <Image
                  key={ex.id}
                  source={{ uri: exerciseGif(ex) }}
                  resizeMode="cover"
                  style={[
                    styles.fanPhoto,
                    {
                      backgroundColor: "#ffffff",
                      borderColor: colors.surface,
                      marginLeft: i === 0 ? 0 : -14,
                      transform: [{ rotate: `${(i - 1) * 4}deg` }],
                      zIndex: gifs.length - i,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
        <PressableScale
          scaleTo={0.97}
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          onPress={onStart}
          style={[styles.routineStart, { backgroundColor: alpha(colors.zest, 0.14) }]}
        >
          <Play size={13} color={colors.zest} />
          <Text style={[styles.routineStartText, type.sansSemiBold, { color: colors.ink }]}>
            Start routine
          </Text>
        </PressableScale>
      </Panel>
    </Pressable>
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
  section: {
    marginTop: 22,
  },
  quickStart: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
  quickStartText: {
    fontSize: 13.5,
  },
  toolRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  toolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  toolLabel: {
    fontSize: 13,
  },
  freshPanel: {
    marginTop: 14,
    alignItems: "center",
  },
  freshTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  freshBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  planHead: {
    marginTop: 18,
    fontSize: 14,
  },
  cards: {
    marginTop: 10,
    gap: 10,
  },
  cardsBare: {
    marginTop: 14,
  },
  liveBanner: {
    marginTop: 10,
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
  routineCard: {
    gap: 12,
  },
  routineTop: {
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
    textTransform: "capitalize",
  },
  routineStart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    paddingVertical: 11,
  },
  routineStartText: {
    fontSize: 13,
  },
  fan: {
    flexDirection: "row",
    alignItems: "center",
  },
  fanPhoto: {
    height: 40,
    width: 48,
    borderRadius: 8,
    borderWidth: 2,
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
});
