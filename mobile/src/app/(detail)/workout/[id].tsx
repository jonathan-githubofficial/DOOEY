import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Plus, Trash2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "@/components/Check";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import {
  emptySet,
  knownExercises,
  previousLookup,
  useDeleteWorkout,
  useRoutines,
  useUpdateWorkout,
  useWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import { useWorkoutPrefs } from "@/features/workouts/store";
import {
  formatElapsed,
  workoutSetsDone,
  workoutVolume,
  type ExerciseKind,
  type WorkoutEntry,
  type WorkoutSet,
} from "@/features/workouts/types";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { playFlip } from "@/lib/sounds";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(400).damping(32);

/** The session sheet: exercises as set grids — previous ghosts, weight, reps,
 * a tick per set — under a running clock, with a rest countdown between sets
 * and a finish plate at the bottom. Finished sessions open read-only. */
export default function WorkoutPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const unit = useWorkoutPrefs((s) => s.unit);
  const restSeconds = useWorkoutPrefs((s) => s.restSeconds);
  const { data: workout } = useWorkout(id);
  const { data: workouts } = useWorkouts();
  const { data: routines } = useRoutines();
  const update = useUpdateWorkout(id);
  const del = useDeleteWorkout();

  const [entries, setEntries] = useState<WorkoutEntry[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  // The rest countdown: an end timestamp, not a counter — background-safe.
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);

  const live = !!workout && !workout.ended_at;
  const effEntries = entries ?? workout?.entries ?? [];
  const effTitle = title ?? workout?.title ?? "";
  const prev = previousLookup((workouts ?? []).filter((w) => w.id !== id));

  const now = useNow(live ? 500 : 60_000);
  // The bar's life is derived, never cleared by an effect — `rest` simply
  // goes stale once expired; the next completed set replaces it.
  const resting = rest !== null && now < rest.until;
  const restRung = useRef(false);
  useEffect(() => {
    if (rest && !resting && !restRung.current) {
      restRung.current = true;
      hapticSuccess();
    }
    if (resting) restRung.current = false;
  }, [rest, resting]);

  if (!workout) return <View style={[styles.screen, { backgroundColor: colors.paper }]} />;

  /** Local state leads, PocketBase follows — every action lands a mutation,
   * so a crash mid-session loses one tap at most. */
  const commit = (next: WorkoutEntry[]) => {
    setEntries(next);
    update.mutate({ entries: next });
  };

  const patchSet = (ei: number, si: number, set: WorkoutSet) => {
    const next = effEntries.map((e, i) =>
      i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? set : s)) } : e,
    );
    const startedRest = live && set.done && !effEntries[ei].sets[si].done;
    commit(next);
    // `now` (the ticking clock) instead of Date.now() — ±half a tick on a
    // 90s rest is nothing, and the handler stays pure.
    if (startedRest) setRest({ until: now + restSeconds * 1000, total: restSeconds });
  };

  const addSet = (ei: number) => {
    hapticTap();
    commit(effEntries.map((e, i) => (i === ei ? { ...e, sets: [...e.sets, emptySet()] } : e)));
  };
  const removeSet = (ei: number, si: number) => {
    commit(
      effEntries
        .map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e))
        .filter((e) => e.sets.length > 0),
    );
  };
  const addExercise = (name: string, kind: ExerciseKind) => {
    setPicking(false);
    const sets = prev.get(name)?.length ?? 3;
    commit([...effEntries, { name, kind, sets: Array.from({ length: sets }, emptySet) }]);
  };
  const removeExercise = (ei: number) =>
    Alert.alert("Remove exercise?", effEntries[ei].name, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => commit(effEntries.filter((_, i) => i !== ei)),
      },
    ]);

  const finish = () => {
    const done = workoutSetsDone(effEntries);
    const close = () => {
      hapticSuccess();
      playFlip();
      // Drop never-touched sets from the record — the log keeps what happened.
      const kept = effEntries
        .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
        .filter((e) => e.sets.length > 0);
      update.mutate({ entries: kept, ended_at: new Date().toISOString() });
      router.back();
    };
    if (done === 0) {
      Alert.alert("Nothing logged", "Finish anyway? This session will be discarded.", [
        { text: "Keep going", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => del.mutate(id, { onSuccess: () => router.back() }),
        },
      ]);
    } else {
      close();
    }
  };

  const started = new Date(workout.started_at).getTime();
  const duration = live ? now - started : new Date(workout.ended_at).getTime() - started;
  const volume = workoutVolume(effEntries);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 140 },
        ]}
      >
        <View style={styles.headRow}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Back to Gym"
            onPress={() => router.back()}
            style={styles.back}
          >
            <ChevronLeft size={22} color={colors.inkMuted} />
          </PressableScale>
          {live ? (
            <TextInput
              value={effTitle}
              onChangeText={setTitle}
              onEndEditing={() => update.mutate({ title: effTitle.trim() || "Workout" })}
              placeholder="Workout"
              placeholderTextColor={alpha(colors.inkMuted, 0.5)}
              style={[styles.titleInput, type.displayBlack, { color: colors.ink }]}
            />
          ) : (
            <Text numberOfLines={1} style={[styles.titleInput, type.displayBlack, { color: colors.ink }]}>
              {effTitle}
            </Text>
          )}
          <Text
            style={[
              styles.clock,
              fontStyle("fraunces", "700"),
              { color: live ? colors.zest : colors.inkMuted },
            ]}
          >
            {formatElapsed(duration)}
          </Text>
        </View>

        {!live && (
          <Text style={[styles.doneLine, type.sans, { color: colors.inkMuted }]}>
            {new Date(workout.started_at).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {" · "}
            {workoutSetsDone(effEntries)} sets
            {volume > 0 ? ` · ${Math.round(volume).toLocaleString()} ${unit}` : ""}
          </Text>
        )}

        <View style={styles.entries}>
          {effEntries.map((entry, ei) => (
            <Animated.View key={`${entry.name}-${ei}`} layout={settle} entering={FadeIn.duration(160)}>
              <Panel style={styles.entryCard}>
                <View style={styles.entryHead}>
                  <Text numberOfLines={1} style={[styles.entryName, type.sansSemiBold, { color: colors.ink }]}>
                    {entry.name}
                  </Text>
                  {live && (
                    <PressableScale
                      scaleTo={0.8}
                      accessibilityLabel={`Remove ${entry.name}`}
                      onPress={() => removeExercise(ei)}
                      style={styles.entryRemove}
                    >
                      <X size={14} color={colors.inkMuted} />
                    </PressableScale>
                  )}
                </View>

                <View style={styles.gridHead}>
                  <Text style={[styles.colSet, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>
                    set
                  </Text>
                  <Text style={[styles.colPrev, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>
                    prev
                  </Text>
                  {entry.kind === "weight_reps" && (
                    <Text style={[styles.colInput, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>
                      {unit}
                    </Text>
                  )}
                  <Text style={[styles.colInput, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>
                    {entry.kind === "duration" ? "secs" : "reps"}
                  </Text>
                  <View style={styles.colCheck} />
                </View>

                {entry.sets.map((set, si) => (
                  <SetRow
                    key={si}
                    index={si}
                    set={set}
                    kind={entry.kind}
                    prev={prev.get(entry.name)?.[si]}
                    live={live}
                    onChange={(s) => patchSet(ei, si, s)}
                    onRemove={() => removeSet(ei, si)}
                  />
                ))}

                {live && (
                  <Pressable
                    accessibilityLabel={`Add a set to ${entry.name}`}
                    onPress={() => addSet(ei)}
                    style={styles.addSet}
                  >
                    <Plus size={12} color={colors.inkMuted} />
                    <Text style={[styles.addSetText, type.sansMedium, { color: colors.inkMuted }]}>
                      add set
                    </Text>
                  </Pressable>
                )}
              </Panel>
            </Animated.View>
          ))}

          {live && (
            <PressableScale
              scaleTo={0.97}
              accessibilityLabel="Add an exercise"
              onPress={() => setPicking(true)}
              style={[styles.addTile, { borderColor: alpha(colors.rule, 0.8) }]}
            >
              <Plus size={15} color={colors.inkMuted} />
              <Text style={[styles.addText, type.sansMedium, { color: colors.inkMuted }]}>
                Add exercise
              </Text>
            </PressableScale>
          )}
        </View>

        {live ? (
          <View style={styles.finishRow}>
            <Plate label="Finish workout" onPress={finish} style={styles.finishPlate} />
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Delete session"
            onPress={() =>
              Alert.alert("Delete this session?", effTitle, [
                { text: "Keep it", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => del.mutate(id, { onSuccess: () => router.back() }),
                },
              ])
            }
            style={styles.deleteRow}
          >
            <Trash2 size={13} color={colors.inkMuted} />
            <Text style={[styles.deleteText, type.sansMedium, { color: colors.inkMuted }]}>
              Delete session
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {resting && rest && live && (
        <Animated.View
          entering={SlideInDown.springify().stiffness(300).damping(28)}
          exiting={SlideOutDown.duration(180)}
          style={[styles.restBar, { bottom: insets.bottom + 14 }]}
        >
          <Panel style={[styles.restPanel, { borderColor: alpha(colors.zest, 0.5) }]}>
            <Text style={[styles.restClock, fontStyle("fraunces", "700"), { color: colors.zest }]}>
              {formatElapsed(Math.max(0, rest.until - now))}
            </Text>
            <Text style={[styles.restLabel, type.sansMedium, { color: colors.inkMuted }]}>rest</Text>
            <View style={styles.restTools}>
              <RestButton label="−15s" onPress={() => setRest((r) => r && { ...r, until: r.until - 15_000 })} />
              <RestButton label="+15s" onPress={() => setRest((r) => r && { ...r, until: r.until + 15_000 })} />
              <RestButton label="skip" onPress={() => setRest(null)} />
            </View>
          </Panel>
        </Animated.View>
      )}

      <ExercisePicker
        visible={picking}
        known={knownExercises(routines ?? [], workouts ?? [])}
        onPick={addExercise}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

function RestButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={[styles.restBtn, { backgroundColor: alpha(colors.ink, 0.06) }]}
    >
      <Text style={[styles.restBtnText, type.sansMedium, { color: colors.ink }]}>{label}</Text>
    </PressableScale>
  );
}

/** One set: number · previous ghost · inputs · tick. Ticking an untouched row
 * adopts the ghost values — logging a repeat of last week is two taps. */
function SetRow({
  index,
  set,
  kind,
  prev,
  live,
  onChange,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  kind: ExerciseKind;
  prev?: WorkoutSet;
  live: boolean;
  onChange: (s: WorkoutSet) => void;
  onRemove: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const [wText, setWText] = useState<string | null>(null);
  const [rText, setRText] = useState<string | null>(null);

  const parse = (t: string | null) => {
    const v = parseFloat((t ?? "").replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  // What this row would log right now: typed > stored > ghost.
  const resolved = (): WorkoutSet => ({
    weight: parse(wText) || set.weight || prev?.weight || 0,
    reps: parse(rText) || set.reps || prev?.reps || 0,
    done: set.done,
  });

  const ghost = prev ? (kind === "weight_reps" ? `${prev.weight}×${prev.reps}` : `${prev.reps}`) : "—";

  return (
    <Pressable
      accessibilityLabel={`Set ${index + 1}`}
      onLongPress={live ? onRemove : undefined}
      style={[styles.setRow, set.done && { backgroundColor: alpha(colors.leaf, 0.08) }]}
    >
      <Text style={[styles.colSet, styles.setIndex, type.sansMedium, { color: colors.inkMuted }]}>
        {index + 1}
      </Text>
      <Text numberOfLines={1} style={[styles.colPrev, styles.prevText, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
        {ghost}
      </Text>
      {kind === "weight_reps" && (
        <SetInput
          value={wText ?? (set.weight > 0 ? String(set.weight) : "")}
          placeholder={prev && prev.weight > 0 ? String(prev.weight) : "—"}
          editable={live}
          onText={setWText}
          onCommit={() => {
            if (wText !== null) onChange({ ...set, weight: parse(wText) });
            setWText(null);
          }}
        />
      )}
      <SetInput
        value={rText ?? (set.reps > 0 ? String(set.reps) : "")}
        placeholder={prev && prev.reps > 0 ? String(prev.reps) : "—"}
        editable={live}
        onText={setRText}
        onCommit={() => {
          if (rText !== null) onChange({ ...set, reps: parse(rText) });
          setRText(null);
        }}
      />
      <View style={styles.colCheck}>
        {live ? (
          <Check
            done={set.done}
            label={`Set ${index + 1} done`}
            size={24}
            onToggle={() => {
              const r = resolved();
              onChange({ ...r, done: !set.done });
              setWText(null);
              setRText(null);
            }}
          />
        ) : (
          <Text style={[styles.setIndex, type.sansMedium, { color: set.done ? colors.leaf : colors.inkMuted }]}>
            {set.done ? "✓" : ""}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function SetInput({
  value,
  placeholder,
  editable,
  onText,
  onCommit,
}: {
  value: string;
  placeholder: string;
  editable: boolean;
  onText: (t: string) => void;
  onCommit: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <TextInput
      value={value}
      onChangeText={onText}
      onEndEditing={onCommit}
      placeholder={placeholder}
      placeholderTextColor={alpha(colors.inkMuted, 0.45)}
      editable={editable}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={[
        styles.colInput,
        styles.setInput,
        type.sansSemiBold,
        { color: colors.ink, backgroundColor: alpha(colors.ink, 0.05) },
      ]}
    />
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
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  back: {
    height: 40,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  titleInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    letterSpacing: -0.5,
    paddingVertical: 4,
  },
  clock: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    marginLeft: 10,
  },
  doneLine: {
    marginTop: 4,
    marginLeft: 38,
    fontSize: 12.5,
  },
  entries: {
    marginTop: 16,
    gap: 12,
  },
  entryCard: {
    gap: 6,
  },
  entryHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  entryName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15.5,
  },
  entryRemove: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  gridHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  colLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  colSet: {
    width: 26,
  },
  colPrev: {
    flex: 1,
    minWidth: 0,
  },
  colInput: {
    width: 62,
    textAlign: "center",
  },
  colCheck: {
    width: 34,
    alignItems: "center",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  setIndex: {
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  prevText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  setInput: {
    height: 34,
    borderRadius: 9,
    fontSize: 14,
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  addSet: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
  },
  addSetText: {
    fontSize: 12,
  },
  addTile: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addText: {
    fontSize: 13,
  },
  finishRow: {
    marginTop: 24,
    alignItems: "center",
  },
  finishPlate: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 15,
  },
  deleteRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  deleteText: {
    fontSize: 12,
  },
  restBar: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  restPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
  restClock: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  restLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    flex: 1,
  },
  restTools: {
    flexDirection: "row",
    gap: 6,
  },
  restBtn: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  restBtnText: {
    fontSize: 11.5,
  },
});
