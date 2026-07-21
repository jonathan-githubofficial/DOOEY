import { useRouter } from "expo-router";
import { BookOpen, ClipboardList, MoreHorizontal, Play } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
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
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The gym: quick start on top, your routines as board-style cards (tap to
 * train, ⋯ to edit), and the log. Explore opens the program catalog. */
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

        <Eyebrow style={styles.section}>quick start</Eyebrow>
        {live ? (
          <LiveBanner workout={live} onPress={() => openWorkout(live.id)} />
        ) : (
          <PressableScale
            scaleTo={0.98}
            accessibilityLabel="Start an empty workout"
            onPress={() => startWorkout(null)}
            disabled={start.isPending}
          >
            <Panel style={[styles.quickStart, { borderColor: alpha(colors.zest, 0.4) }]}>
              <View style={[styles.quickIcon, { backgroundColor: alpha(colors.zest, 0.14) }]}>
                <Play size={16} color={colors.zest} />
              </View>
              <View style={styles.quickText}>
                <Text style={[styles.quickTitle, type.sansSemiBold, { color: colors.ink }]}>
                  Start empty workout
                </Text>
                <Text style={[styles.quickSub, type.sans, { color: colors.inkMuted }]}>
                  Log freestyle — pull exercises in as you go.
                </Text>
              </View>
            </Panel>
          </PressableScale>
        )}

        <View style={styles.routineHeadRow}>
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
              <RoutineCard routine={r} onStart={() => startWorkout(r)} onEdit={() => router.push({ pathname: "/routine/[id]", params: { id: r.id } })} />
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

/** A routine as a board-style card: title + description, a fan of demo loops
 * off the bottom. Tapping the card starts the workout; ⋯ edits or deletes. */
function RoutineCard({
  routine,
  onStart,
  onEdit,
}: {
  routine: Routine;
  onStart: () => void;
  onEdit: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const radius = useCardRadius();
  const del = useDeleteRoutine();
  const gifs = routine.items
    .map((i) => libraryExercise(i.libId))
    .filter((e) => !!e)
    .slice(0, 3);

  return (
    <PressableScale scaleTo={0.99} accessibilityLabel={`Start ${routine.name}`} onPress={onStart}>
      <Panel style={styles.card}>
        <View style={[styles.cardClip, { borderRadius: radius - 1 }]}>
          <Text numberOfLines={1} style={[styles.cardTitle, type.display, { color: colors.ink }]}>
            {routine.name}
          </Text>
          <Text numberOfLines={2} style={[styles.cardDesc, type.sans, { color: colors.inkMuted }]}>
            {routine.description ||
              (routine.items.length
                ? routine.items.map((i) => i.name).join(", ")
                : "No exercises yet — ⋯ to edit")}
          </Text>

          <View style={styles.fanArea} pointerEvents="none">
            {gifs.length === 0 ? (
              <Text style={[styles.emptyStar, { color: alpha(colors.inkMuted, 0.2) }]}>✦</Text>
            ) : (
              gifs.map((ex, i) => {
                const spread = i - (gifs.length - 1) / 2;
                return (
                  <View
                    key={ex.id}
                    style={[
                      styles.fanTile,
                      {
                        left: `${30 + spread * 22}%`,
                        bottom: `${-12 - Math.abs(spread) * 2}%`,
                        zIndex: i,
                        backgroundColor: colors.surface,
                        transform: [{ rotate: `${spread * 9}deg` }],
                      },
                    ]}
                  >
                    <Image source={{ uri: exerciseGif(ex) }} style={styles.fanFill} resizeMode="cover" />
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* ▶ hint that the card trains — the tap target is the whole card. */}
        <View style={[styles.cardStart, { backgroundColor: colors.ink }]} pointerEvents="none">
          <Play size={16} color={colors.paper} />
        </View>

        <Pressable
          accessibilityLabel={`${routine.name} options`}
          hitSlop={6}
          onPress={() =>
            Alert.alert(routine.name, undefined, [
              { text: "Edit routine", onPress: onEdit },
              { text: "Delete routine", style: "destructive", onPress: () => del.mutate(routine.id) },
              { text: "Cancel", style: "cancel" },
            ])
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
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginTop: 22 },
  quickStart: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
  },
  quickIcon: {
    height: 40,
    width: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { flex: 1, minWidth: 0 },
  quickTitle: { fontSize: 15 },
  quickSub: { marginTop: 1, fontSize: 12 },
  routineHeadRow: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  card: { aspectRatio: 16 / 9, padding: 0 },
  cardClip: { flex: 1, overflow: "hidden", padding: 16 },
  cardTitle: { maxWidth: "72%", fontSize: 18, letterSpacing: -0.3 },
  cardDesc: { marginTop: 3, maxWidth: "62%", fontSize: 12, lineHeight: 16 },
  menuBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  cardStart: {
    position: "absolute",
    right: 14,
    bottom: 14,
    height: 44,
    width: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#282018",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fanArea: { position: "absolute", left: 0, right: 0, bottom: 0, top: "42%" },
  emptyStar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    textAlign: "center",
    fontSize: 30,
  },
  fanTile: {
    position: "absolute",
    width: "34%",
    aspectRatio: 1.1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    overflow: "hidden",
    shadowColor: "#282018",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fanFill: { flex: 1 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyText: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: 14.5 },
  historySub: { marginTop: 2, fontSize: 12 },
  empty: { fontSize: 12.5, textAlign: "center", paddingVertical: 8 },
});
