import { useRouter } from "expo-router";
import { BookOpen, ClipboardList, MoreHorizontal, Play, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { fontStyle } from "@/features/style/tokens";
import {
  useDeleteRoutine,
  useDeleteWorkout,
  useRoutines,
  useSaveRoutine,
  useSeedStarterRoutines,
  useStartWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import { exerciseGif, libraryExercise } from "@/features/workouts/library";
import { STARTER_ROUTINES } from "@/features/workouts/starters";
import { formatRest, useWorkoutPrefs } from "@/features/workouts/store";
import {
  formatElapsed,
  workoutSetsDone,
  workoutVolume,
  type Routine,
  type Workout,
} from "@/features/workouts/types";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The gym space, Hevy-shaped: quick start on top, routines as board-style
 * cards grouped by plan (tap → preview, ▶ → train), and the log. */
export default function Gym() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: routines } = useRoutines();
  const { data: workouts, isPending } = useWorkouts();
  const saveRoutine = useSaveRoutine();
  const start = useStartWorkout();
  const seed = useSeedStarterRoutines();
  const seededFlag = useWorkoutPrefs((s) => s.seededRoutines);
  const markSeeded = useWorkoutPrefs((s) => s.markSeeded);
  const [preview, setPreview] = useState<Routine | null>(null);
  const [exploring, setExploring] = useState(false);

  const live = workouts?.find((w) => !w.ended_at) ?? null;
  const history = (workouts ?? []).filter((w) => w.ended_at);
  const routinesReady = !!routines;

  // First open with an empty, never-seeded gym → plant the starter split once.
  useEffect(() => {
    if (routinesReady && routines.length === 0 && !seededFlag && !seed.isPending) {
      markSeeded();
      seed.mutate(STARTER_ROUTINES);
    }
  }, [routinesReady, routines, seededFlag, seed, markSeeded]);

  const plans = [...new Set((routines ?? []).map((r) => r.group).filter(Boolean))];
  const loose = (routines ?? []).filter((r) => !r.group);

  const openWorkout = (wid: string) =>
    router.push({ pathname: "/workout/[id]", params: { id: wid } });
  const openRoutine = (rid: string) =>
    router.push({ pathname: "/routine/[id]", params: { id: rid } });

  const startWorkout = (routine: Routine | null) => {
    setPreview(null);
    if (live) return openWorkout(live.id); // one session at a time
    start.mutate(routine, { onSuccess: (w) => openWorkout(w.id) });
  };

  const newRoutine = () =>
    saveRoutine.mutate(
      { name: "New routine", items: [], position: routines?.length ?? 0 },
      { onSuccess: (r) => openRoutine(r.id) },
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
          <Eyebrow>routines</Eyebrow>
          <View style={styles.tools}>
            <ToolButton label="Explore" icon={<BookOpen size={14} color={colors.inkMuted} />} onPress={() => setExploring(true)} />
            <ToolButton
              label="New"
              icon={<ClipboardList size={14} color={colors.inkMuted} />}
              onPress={newRoutine}
              disabled={saveRoutine.isPending}
            />
          </View>
        </View>

        {plans.map((plan) => (
          <View key={plan}>
            <Text style={[styles.planHead, type.sansSemiBold, { color: colors.ink }]}>{plan}</Text>
            <View style={styles.cards}>
              {(routines ?? [])
                .filter((r) => r.group === plan)
                .map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(220)}>
                    <RoutineCard routine={r} onOpen={() => setPreview(r)} onStart={() => startWorkout(r)} />
                  </Animated.View>
                ))}
            </View>
          </View>
        ))}

        {loose.length > 0 && (
          <>
            {plans.length > 0 && (
              <Text style={[styles.planHead, type.sansSemiBold, { color: colors.ink }]}>Other</Text>
            )}
            <View style={[styles.cards, plans.length === 0 && styles.cardsTop]}>
              {loose.map((r, i) => (
                <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(220)}>
                  <RoutineCard routine={r} onOpen={() => setPreview(r)} onStart={() => startWorkout(r)} />
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

        {!isPending && (routines ?? []).length === 0 && (
          <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
            Setting up your starter routines…
          </Text>
        )}
      </ScrollView>

      <RoutinePreview
        routine={preview}
        onStart={() => preview && startWorkout(preview)}
        onEdit={() => {
          const r = preview;
          setPreview(null);
          if (r) openRoutine(r.id);
        }}
        onClose={() => setPreview(null)}
      />

      {/* Explore: the library as pure reference — how-tos, nothing added. */}
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

/** A routine as a board-style card: title + description up top, a fan of the
 * exercises' demo loops bleeding off the bottom, a ▶ to train and a ⋯ menu.
 * Tapping the body opens the preview. */
function RoutineCard({
  routine,
  onOpen,
  onStart,
}: {
  routine: Routine;
  onOpen: () => void;
  onStart: () => void;
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
    <PressableScale scaleTo={0.99} accessibilityLabel={`Routine ${routine.name}`} onPress={onOpen}>
      <Panel style={styles.card}>
        <View style={[styles.cardClip, { borderRadius: radius - 1 }]}>
          <Text numberOfLines={1} style={[styles.cardTitle, type.display, { color: colors.ink }]}>
            {routine.name}
          </Text>
          <Text numberOfLines={2} style={[styles.cardDesc, type.sans, { color: colors.inkMuted }]}>
            {routine.description ||
              (routine.items.length
                ? routine.items.map((i) => i.name).join(", ")
                : "No exercises yet — tap to build")}
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

        {/* ▶ train — the one-tap job, floated bottom-right like a stamp. */}
        <PressableScale
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          onPress={onStart}
          style={[styles.cardStart, { backgroundColor: colors.ink }]}
        >
          <Play size={16} color={colors.paper} />
        </PressableScale>

        <Pressable
          accessibilityLabel="Routine options"
          hitSlop={6}
          onPress={() =>
            Alert.alert(routine.name, undefined, [
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

/** The routine preview: what you're about to start — exercises with their
 * target sets × reps and demo loops — with Start and Edit. */
function RoutinePreview({
  routine,
  onStart,
  onEdit,
  onClose,
}: {
  routine: Routine | null;
  onStart: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const defaultRest = useWorkoutPrefs((s) => s.restSeconds);

  return (
    <Modal visible={!!routine} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.previewBackdrop} onPress={onClose}>
        <Animated.View entering={FadeIn.duration(160)}>
          <Pressable
            onPress={() => {}}
            style={[
              styles.previewSheet,
              { backgroundColor: colors.paper, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <Grain />
            {routine && (
              <>
                <View style={styles.previewHead}>
                  <View style={styles.previewTitleText}>
                    <Text numberOfLines={1} style={[styles.previewTitle, fontStyle("fraunces", "900"), { color: colors.ink }]}>
                      {routine.name}
                    </Text>
                    {!!routine.description && (
                      <Text style={[styles.previewDesc, type.sans, { color: colors.inkMuted }]}>
                        {routine.description}
                      </Text>
                    )}
                  </View>
                  <PressableScale scaleTo={0.85} accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                    <X size={18} color={colors.inkMuted} />
                  </PressableScale>
                </View>

                <ScrollView style={styles.previewList} showsVerticalScrollIndicator={false}>
                  {routine.items.map((item, i) => {
                    const ex = libraryExercise(item.libId);
                    return (
                      <View key={i} style={[styles.previewRow, { borderBottomColor: alpha(colors.rule, 0.4) }]}>
                        {ex ? (
                          <Image source={{ uri: exerciseGif(ex) }} resizeMode="cover" style={[styles.previewThumb, { backgroundColor: "#fff" }]} />
                        ) : (
                          <View style={[styles.previewThumb, { backgroundColor: alpha(colors.ink, 0.05) }]} />
                        )}
                        <View style={styles.previewRowText}>
                          <Text numberOfLines={1} style={[styles.previewExName, type.sansMedium, { color: colors.ink }]}>
                            {item.name}
                          </Text>
                          <Text style={[styles.previewExSub, type.sans, { color: colors.inkMuted }]}>
                            {item.sets} × {item.target_reps}
                            {item.kind === "weight_reps" ? " reps" : item.kind === "duration" ? "s" : " reps"}
                            {" · "}
                            {formatRest(item.rest ?? defaultRest)} rest
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {routine.items.length === 0 && (
                    <Text style={[styles.previewEmpty, type.sans, { color: colors.inkMuted }]}>
                      No exercises yet — hit Edit to build it.
                    </Text>
                  )}
                </ScrollView>

                <View style={styles.previewActions}>
                  <PressableScale
                    scaleTo={0.96}
                    accessibilityLabel="Edit routine"
                    onPress={onEdit}
                    style={[styles.previewEdit, { borderColor: alpha(colors.rule, 0.8) }]}
                  >
                    <Text style={[styles.previewEditText, type.sansMedium, { color: colors.ink }]}>
                      Edit
                    </Text>
                  </PressableScale>
                  <Plate label="Start routine" onPress={onStart} style={styles.previewStart} />
                </View>
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
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
  planHead: { marginTop: 18, fontSize: 14 },
  cards: { marginTop: 10, gap: 14 },
  cardsTop: { marginTop: 14 },
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
  // Board-style routine card.
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
  empty: { marginTop: 16, fontSize: 12.5, textAlign: "center" },
  // Preview sheet.
  previewBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,16,12,0.35)",
  },
  previewSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    maxHeight: "80%",
    overflow: "hidden",
  },
  close: { height: 34, width: 34, alignItems: "center", justifyContent: "center" },
  previewHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  previewTitleText: { flex: 1, minWidth: 0 },
  previewTitle: { fontSize: 24, letterSpacing: -0.3 },
  previewDesc: { marginTop: 3, fontSize: 13, lineHeight: 18 },
  previewList: { marginTop: 14 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  previewThumb: { height: 40, width: 52, borderRadius: 8 },
  previewRowText: { flex: 1, minWidth: 0 },
  previewExName: { fontSize: 14 },
  previewExSub: { marginTop: 2, fontSize: 11.5 },
  previewEmpty: { paddingVertical: 20, fontSize: 12.5, textAlign: "center" },
  previewActions: { marginTop: 16, flexDirection: "row", gap: 10 },
  previewEdit: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  previewEditText: { fontSize: 13, letterSpacing: 0.3 },
  previewStart: { flex: 1, borderRadius: 14, paddingVertical: 15 },
});
