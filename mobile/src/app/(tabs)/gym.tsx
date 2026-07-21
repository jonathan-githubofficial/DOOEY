import { useRouter } from "expo-router";
import { BookOpen, ClipboardList, MoreHorizontal } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { fontStyle } from "@/features/style/tokens";
import {
  useAddRoutines,
  useDeleteRoutine,
  useDeleteWorkout,
  useRoutines,
  useSaveRoutine,
  useStartWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { ProgramsExplorer } from "@/features/workouts/components/ProgramsExplorer";
import { exerciseGif, libraryExercise } from "@/features/workouts/library";
import type { Program, ProgramRoutine } from "@/features/workouts/programs";
import { STARTER_ROUTINES } from "@/features/workouts/starters";
import { useWorkoutPrefs } from "@/features/workouts/store";
import {
  formatElapsed,
  workoutSetsDone,
  workoutVolume,
  type Routine,
  type RoutineTemplate,
  type Workout,
} from "@/features/workouts/types";
import { confirmDestructive } from "@/lib/confirm";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The gym: your routines as board-style cards (tap to open the routine, where
 * you start the workout), the running session up top if any, and the log
 * below. Explore opens the program catalog. */
export default function Gym() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: routines } = useRoutines();
  const { data: workouts, isPending } = useWorkouts();
  const saveRoutine = useSaveRoutine();
  const addRoutines = useAddRoutines();
  const start = useStartWorkout();
  const seededFlag = useWorkoutPrefs((s) => s.seededRoutines);
  const markSeeded = useWorkoutPrefs((s) => s.markSeeded);
  const [exploring, setExploring] = useState(false);

  const live = workouts?.find((w) => !w.ended_at) ?? null;
  const history = (workouts ?? []).filter((w) => w.ended_at);
  const routinesReady = !!routines;

  // First open with an empty, never-seeded gym → plant the PPL starter split.
  useEffect(() => {
    if (routinesReady && routines.length === 0 && !seededFlag && !addRoutines.isPending) {
      markSeeded();
      addRoutines.mutate(STARTER_ROUTINES);
    }
  }, [routinesReady, routines, seededFlag, addRoutines, markSeeded]);

  const openWorkout = (wid: string) =>
    router.push({ pathname: "/workout/[id]", params: { id: wid } });

  const startWorkout = (routine: RoutineTemplate | null) => {
    if (live) return openWorkout(live.id); // one session at a time
    start.mutate(routine, { onSuccess: (w) => openWorkout(w.id) });
  };

  const newRoutine = () =>
    saveRoutine.mutate(
      { name: "New routine", items: [] },
      { onSuccess: (r) => router.push({ pathname: "/routine/[id]", params: { id: r.id } }) },
    );

  const addProgram = (program: Program) =>
    addRoutines.mutate(
      program.routines.map((r) => ({
        name: r.name,
        description: `${program.name} · ${r.name}`,
        items: r.items,
      })),
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
        <Masthead avatar={<PageDoodle page="gym" />} title="Gym" />

        {live && (
          <View style={styles.liveWrap}>
            <LiveBanner workout={live} onPress={() => openWorkout(live.id)} />
          </View>
        )}

        <View style={[styles.routineHeadRow, live && styles.routineHeadTight]}>
          <Eyebrow>my routines</Eyebrow>
          <View style={styles.tools}>
            <ToolButton
              label="Explore"
              icon={<BookOpen size={14} color={colors.inkMuted} />}
              onPress={() => setExploring(true)}
            />
            <ToolButton
              label="New"
              icon={<ClipboardList size={14} color={colors.inkMuted} />}
              onPress={newRoutine}
              disabled={saveRoutine.isPending}
            />
          </View>
        </View>

        <View style={styles.cards}>
          {(routines ?? []).map((r, i) => (
            <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <RoutineCard routine={r} onOpen={() => router.push({ pathname: "/routine/[id]", params: { id: r.id } })} />
            </Animated.View>
          ))}
          {!isPending && (routines ?? []).length === 0 && (
            <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
              Setting up your starter routines…
            </Text>
          )}
        </View>

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

      <ProgramsExplorer
        visible={exploring}
        onStartRoutine={(r: ProgramRoutine) => {
          setExploring(false);
          startWorkout({ name: r.name, items: r.items });
        }}
        onAddProgram={addProgram}
        onClose={() => setExploring(false)}
      />
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
      scaleTo={0.94}
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

/** A routine as a board-style card: title + description and a strip of the
 * exercises' demo loops. Tapping opens the routine page (where you start);
 * ⋯ deletes. */
function RoutineCard({ routine, onOpen }: { routine: Routine; onOpen: () => void }) {
  const colors = usePalette();
  const type = useType();
  const del = useDeleteRoutine();
  const gifs = routine.items
    .map((i) => libraryExercise(i.libId))
    .filter((e) => !!e)
    .slice(0, 4);
  const count = routine.items.length;

  return (
    <PressableScale scaleTo={0.99} accessibilityLabel={`Open ${routine.name}`} onPress={onOpen}>
      <Panel>
        <Text numberOfLines={1} style={[styles.cardTitle, type.display, { color: colors.ink }]}>
          {routine.name}
        </Text>
        <Text numberOfLines={1} style={[styles.cardDesc, type.sans, { color: colors.inkMuted }]}>
          {routine.description || `${count} ${count === 1 ? "exercise" : "exercises"}`}
        </Text>

        {/* A tidy strip of demo loops — reads as "put together" even with a
            couple of exercises, unlike a lonely fan. */}
        <View style={styles.stripRow}>
          {gifs.length === 0 ? (
            <Text style={[styles.stripEmpty, type.sans, { color: alpha(colors.inkMuted, 0.6) }]}>
              No exercises yet — tap to build it.
            </Text>
          ) : (
            <>
              {gifs.map((ex) => (
                <Image
                  key={ex.id}
                  source={{ uri: exerciseGif(ex) }}
                  resizeMode="cover"
                  style={[styles.stripPhoto, { borderColor: alpha(colors.rule, 0.6) }]}
                />
              ))}
              {count > gifs.length && (
                <View style={[styles.stripMore, { backgroundColor: alpha(colors.ink, 0.06) }]}>
                  <Text style={[styles.stripMoreText, type.sansMedium, { color: colors.inkMuted }]}>
                    +{count - gifs.length}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <Pressable
          accessibilityLabel={`${routine.name} options`}
          hitSlop={10}
          onPress={() =>
            confirmDestructive(
              `Delete “${routine.name}”?`,
              "This removes the routine. Logged sessions stay in your history.",
              "Delete routine",
              () => del.mutate(routine.id),
            )
          }
          style={styles.menuBtn}
        >
          <MoreHorizontal size={16} color={colors.inkMuted} />
        </Pressable>
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
        confirmDestructive("Delete this session?", `${workout.title} — ${day}`, "Delete", () =>
          del.mutate(workout.id),
        )
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
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginTop: 22 },
  liveWrap: { marginTop: 16 },
  routineHeadRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routineHeadTight: { marginTop: 20 },
  tools: { flexDirection: "row", gap: 8 },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  toolLabel: { fontSize: 12.5 },
  cards: { marginTop: 12, gap: 14 },
  liveBanner: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
  },
  liveDot: { height: 8, width: 8, borderRadius: 999 },
  liveText: { flex: 1, minWidth: 0 },
  liveTitle: { fontSize: 15 },
  liveSub: { marginTop: 1, fontSize: 12 },
  liveClock: { fontSize: 22, fontVariant: ["tabular-nums"] },
  cardTitle: { maxWidth: "80%", fontSize: 18, letterSpacing: -0.3 },
  cardDesc: { marginTop: 3, maxWidth: "80%", fontSize: 12.5, lineHeight: 16 },
  menuBtn: {
    position: "absolute",
    right: 10,
    top: 10,
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  stripRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  stripPhoto: {
    height: 56,
    width: 64,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  stripMore: {
    height: 56,
    width: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stripMoreText: { fontSize: 13 },
  stripEmpty: { fontSize: 12.5, paddingVertical: 18 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyText: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: 14.5 },
  historySub: { marginTop: 2, fontSize: 12 },
  empty: { fontSize: 12.5, textAlign: "center", paddingVertical: 8 },
});
