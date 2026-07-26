import { useLocalSearchParams, useRouter } from "expo-router";
import { Check as CheckIcon, ChevronLeft, Pause as PauseIcon, Play, Plus, Square, Timer, Trash2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition, SlideInDown, SlideOutDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import {
  emptySet,
  personalRecords,
  previousLookup,
  restLookup,
  useDeleteWorkout,
  useFinishWorkout,
  useTogglePause,
  useUpdateWorkout,
  useWorkout,
  useWorkouts,
  type ExerciseRecord,
} from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { ExercisePicker, type PickedExercise } from "@/features/workouts/components/ExercisePicker";
import { KeyPad } from "@/features/workouts/components/KeyPad";
import { exerciseGif, libraryExercise } from "@/features/workouts/library";
import { formatRest, useWorkoutPrefs } from "@/features/workouts/store";
import {
  epley1RM,
  formatElapsed,
  workoutElapsed,
  workoutSetsDone,
  workoutVolume,
  type WorkoutEntry,
  type WorkoutSet,
} from "@/features/workouts/types";
import { confirmDestructive } from "@/lib/confirm";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { playFlip } from "@/lib/sounds";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(400).damping(32);

type Focus = { ei: number; si: number; field: "weight" | "reps" };

function parseNum(s: string): number {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : 0;
}
function sanitize(s: string): string {
  const cleaned = s.replace(/[^0-9.]/g, "");
  const [head, ...rest] = cleaned.split(".");
  const joined = rest.length ? `${head}.${rest.join("")}` : head;
  return joined.slice(0, 6);
}

/** The session: exercises as set grids, logged through a docked keypad and a
 * Start → Stop per set that fires the exercise's rest timer. Weights and rest
 * are remembered from last time. Finished sessions open read-only. */
export default function WorkoutPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const unit = useWorkoutPrefs((s) => s.unit);
  const defaultRest = useWorkoutPrefs((s) => s.restSeconds);
  const autoStartRest = useWorkoutPrefs((s) => s.autoStartRest);
  const restDoneBuzz = useWorkoutPrefs((s) => s.restDoneBuzz);
  const { data: workout } = useWorkout(id);
  const { data: workouts } = useWorkouts();
  const update = useUpdateWorkout(id);
  const finishWorkout = useFinishWorkout();
  const pause = useTogglePause();
  const del = useDeleteWorkout();

  const [entries, setEntries] = useState<WorkoutEntry[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [editStr, setEditStr] = useState("");
  const [running, setRunning] = useState<string | null>(null); // "ei:si"
  // Exercises opted into timed sets (Start→Stop); the default is one-tap done.
  const [timedMode, setTimedMode] = useState<Set<number>>(new Set());
  // Rest countdown: an end timestamp + which exercise it belongs to (so ±15s
  // updates that exercise's remembered rest). Background-safe.
  const [rest, setRest] = useState<{ until: number; total: number; ei: number } | null>(null);

  const live = !!workout && !workout.ended_at;
  const effEntries = entries ?? workout?.entries ?? [];
  const effTitle = title ?? workout?.title ?? "";
  const others = (workouts ?? []).filter((w) => w.id !== id);
  const prev = previousLookup(others);
  const restMem = restLookup(others);
  const records = personalRecords(others);

  const now = useNow(live ? 500 : 60_000);
  const resting = rest !== null && now < rest.until;
  const restRung = useRef(false);
  useEffect(() => {
    if (rest && !resting && !restRung.current) {
      restRung.current = true;
      if (restDoneBuzz) hapticSuccess();
    }
    if (resting) restRung.current = false;
  }, [rest, resting, restDoneBuzz]);

  if (!workout) return <View style={[styles.screen, { backgroundColor: colors.paper }]} />;

  /** Local state leads, PocketBase follows — a crash mid-session loses a tap. */
  const commit = (next: WorkoutEntry[]) => {
    setEntries(next);
    update.mutate({ entries: next });
  };
  const patchSet = (ei: number, si: number, patch: Partial<WorkoutSet>) =>
    commit(
      effEntries.map((e, i) =>
        i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e,
      ),
    );
  const entryRest = (e: WorkoutEntry) => e.rest ?? defaultRest;

  // --- keypad ---
  const openCell = (ei: number, si: number, field: "weight" | "reps", current: number) => {
    hapticTap();
    setFocus({ ei, si, field });
    setEditStr(current > 0 ? String(current) : "");
  };
  const typeDigit = (d: string) => {
    if (!focus) return;
    const nextStr = sanitize(editStr + d);
    setEditStr(nextStr);
    patchSet(focus.ei, focus.si, { [focus.field]: parseNum(nextStr) });
  };
  const backspace = () => {
    if (!focus) return;
    const nextStr = editStr.slice(0, -1);
    setEditStr(nextStr);
    patchSet(focus.ei, focus.si, { [focus.field]: parseNum(nextStr) });
  };
  const keypadNext = () => {
    if (!focus) return;
    const entry = effEntries[focus.ei];
    if (focus.field === "weight") {
      openCell(focus.ei, focus.si, "reps", entry.sets[focus.si].reps);
    } else {
      setFocus(null);
    }
  };
  // Quick weight bumps on the keypad — progression is one tap, off whatever's
  // showing (your draft, the seeded target, or last time's number).
  const bumpWeight = (n: number) => {
    if (!focus) return;
    const entry = effEntries[focus.ei];
    const base =
      parseNum(editStr) ||
      entry.sets[focus.si].weight ||
      prev.get(entry.name)?.[focus.si]?.weight ||
      0;
    const nextStr = sanitize(String(base + n));
    setEditStr(nextStr);
    patchSet(focus.ei, focus.si, { weight: parseNum(nextStr) });
  };

  // Log a set. One tap by default; the opt-in timed mode splits it into Start
  // (mark it running) then Stop, which lands here too. Blank fields adopt last
  // time's numbers, so repeating a set needs no typing at all.
  const finishSet = (ei: number, si: number) => {
    const entry = effEntries[ei];
    const set = entry.sets[si];
    const ghost = prev.get(entry.name)?.[si];
    const filled: WorkoutSet = {
      weight: set.weight || ghost?.weight || 0,
      reps: set.reps || ghost?.reps || 0,
      done: true,
    };
    commit(effEntries.map((e, i) => (i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? filled : s)) } : e)));
    setRunning((r) => (r === `${ei}:${si}` ? null : r));
    // Beating your best estimated-1RM is a PR — celebrate a touch louder.
    const rec = records.get(entry.name);
    if (rec && rec.oneRM > 0 && epley1RM(filled.weight, filled.reps) > rec.oneRM) playFlip();
    hapticSuccess();
    if (autoStartRest) setRest({ until: now + entryRest(entry) * 1000, total: entryRest(entry), ei });
  };
  const startSet = (ei: number, si: number) => {
    hapticTap();
    setFocus(null);
    setRunning(`${ei}:${si}`);
  };
  const undoSet = (ei: number, si: number) => {
    patchSet(ei, si, { done: false });
    setRunning((r) => (r === `${ei}:${si}` ? null : r));
  };
  const toggleTimed = (ei: number) => {
    hapticTap();
    setTimedMode((cur) => {
      const next = new Set(cur);
      if (next.has(ei)) next.delete(ei);
      else next.add(ei);
      return next;
    });
  };

  const addSet = (ei: number) =>
    commit(effEntries.map((e, i) => (i === ei ? { ...e, sets: [...e.sets, emptySet()] } : e)));
  const removeSet = (ei: number, si: number) =>
    commit(
      effEntries
        .map((e, i) => (i === ei ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e))
        .filter((e) => e.sets.length > 0),
    );
  const setNotes = (ei: number, notes: string) =>
    commit(effEntries.map((e, i) => (i === ei ? { ...e, notes } : e)));
  const addExercises = (picked: PickedExercise[]) => {
    commit([
      ...effEntries,
      ...picked.map((p) => ({
        name: p.name,
        kind: p.kind,
        libId: p.libId,
        rest: restMem.get(p.name) ?? defaultRest,
        sets: Array.from({ length: prev.get(p.name)?.length ?? 3 }, emptySet),
      })),
    ]);
  };
  const removeExercise = (ei: number) =>
    confirmDestructive("Remove exercise?", effEntries[ei].name, "Remove", () =>
      commit(effEntries.filter((_, i) => i !== ei)),
    );
  const bumpRest = (delta: number) => {
    if (!rest) return;
    const total = Math.max(15, rest.total + delta);
    setRest({ ...rest, until: rest.until + delta * 1000, total });
    // Remember the adjusted rest on the exercise it belongs to.
    commit(effEntries.map((e, i) => (i === rest.ei ? { ...e, rest: total } : e)));
  };

  const finish = () => {
    const done = workoutSetsDone(effEntries);
    const close = () => {
      hapticSuccess();
      playFlip();
      // The record still holds what was last committed; hand the mutation the
      // entries on screen so a set ticked a moment ago isn't dropped.
      finishWorkout.mutate({ ...workout, entries: effEntries });
      router.back();
    };
    if (done === 0) {
      confirmDestructive(
        "Nothing logged yet",
        "Finish anyway? This session will be discarded.",
        "Discard session",
        () => del.mutate(id, { onSuccess: () => router.back() }),
      );
    } else {
      close();
    }
  };

  const paused = !!workout.paused_at;
  const duration = workoutElapsed(workout, now);
  const volume = workoutVolume(effEntries);
  const focusEntry = focus ? effEntries[focus.ei] : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      {/* Pinned above the scroller: the way back, the session's name and its
          two controls stay put while the log runs under them. */}
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
        {/* The same two discs the live bar carries, in the same tints — the
            bar stands down on this page, so its controls surface up here. */}
        {live && (
          <View style={styles.headTools}>
            <Disc
              label={paused ? "Resume workout" : "Pause workout"}
              tint={colors.zest}
              onPress={() => {
                hapticTap();
                pause.mutate(workout);
              }}
            >
              {paused ? (
                <Play size={15} color={colors.zest} fill={colors.zest} />
              ) : (
                <PauseIcon size={15} color={colors.zest} fill={colors.zest} />
              )}
            </Disc>
            <Disc label="Finish workout" tint={colors.clay} onPress={finish}>
              <Square size={13} color={colors.clay} fill={colors.clay} />
            </Disc>
          </View>
        )}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + (focus ? 360 : 150) },
        ]}
      >
        <View style={[styles.stats, { borderBottomColor: alpha(colors.rule, 0.5) }]}>
          <Stat
            label={paused ? "paused" : "duration"}
            value={formatElapsed(duration)}
            tone={live && !paused ? colors.zest : colors.inkMuted}
          />
          <Stat
            label="volume"
            value={volume > 0 ? `${Math.round(volume).toLocaleString()} ${unit}` : "—"}
            tone={colors.ink}
          />
          <Stat label="sets" value={String(workoutSetsDone(effEntries))} tone={colors.ink} />
        </View>

        <View style={styles.entries}>
          {effEntries.map((entry, ei) => (
            <Animated.View key={`${entry.name}-${ei}`} layout={settle} entering={FadeIn.duration(160)}>
              <Panel style={styles.entryCard}>
                <View style={styles.entryHead}>
                  <EntryThumb libId={entry.libId} />
                  <View style={styles.entryTitleText}>
                    <Text numberOfLines={1} style={[styles.entryName, type.sansSemiBold, { color: colors.zest }]}>
                      {entry.name}
                    </Text>
                    <Text style={[styles.entryRest, type.sans, { color: colors.inkMuted }]}>
                      rest {formatRest(entryRest(entry))}
                    </Text>
                  </View>
                  {live && (
                    <View style={styles.entryTools}>
                      <PressableScale
                        scaleTo={0.8}
                        accessibilityLabel={timedMode.has(ei) ? "Timed sets on" : "Time these sets"}
                        onPress={() => toggleTimed(ei)}
                        style={styles.entryRemove}
                      >
                        <Timer size={15} color={timedMode.has(ei) ? colors.zest : alpha(colors.inkMuted, 0.7)} />
                      </PressableScale>
                      <PressableScale
                        scaleTo={0.8}
                        accessibilityLabel={`Remove ${entry.name}`}
                        onPress={() => removeExercise(ei)}
                        style={styles.entryRemove}
                      >
                        <X size={14} color={colors.inkMuted} />
                      </PressableScale>
                    </View>
                  )}
                </View>

                {(live || !!entry.notes) && (
                  <TextInput
                    value={entry.notes ?? ""}
                    onChangeText={(t) => setNotes(ei, t)}
                    editable={live}
                    placeholder="Add notes here…"
                    placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                    style={[styles.notes, type.sans, { color: colors.inkMuted }]}
                    multiline
                  />
                )}

                <View style={styles.gridHead}>
                  <Text style={[styles.colSet, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>set</Text>
                  <Text style={[styles.colPrev, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>prev</Text>
                  <Text style={[styles.colInput, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>{unit}</Text>
                  <Text style={[styles.colInput, styles.colLabel, type.sansMedium, { color: colors.inkMuted }]}>reps</Text>
                  <View style={styles.colAction} />
                </View>

                {entry.sets.map((set, si) => (
                  <SetRow
                    key={si}
                    index={si}
                    set={set}
                    prev={prev.get(entry.name)?.[si]}
                    record={records.get(entry.name)}
                    live={live}
                    timed={timedMode.has(ei)}
                    running={running === `${ei}:${si}`}
                    focusField={focus && focus.ei === ei && focus.si === si ? focus.field : null}
                    editStr={editStr}
                    onOpenCell={(field, current) => openCell(ei, si, field, current)}
                    onComplete={() => finishSet(ei, si)}
                    onStart={() => startSet(ei, si)}
                    onStop={() => finishSet(ei, si)}
                    onUndo={() => undoSet(ei, si)}
                    onRemove={() => removeSet(ei, si)}
                  />
                ))}

                {live && (
                  <PressableScale
                    scaleTo={0.98}
                    accessibilityLabel={`Add a set to ${entry.name}`}
                    onPress={() => addSet(ei)}
                    style={[styles.addSet, { backgroundColor: alpha(colors.ink, 0.05) }]}
                  >
                    <Plus size={13} color={colors.inkMuted} />
                    <Text style={[styles.addSetText, type.sansMedium, { color: colors.ink }]}>Add set</Text>
                  </PressableScale>
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
              <Text style={[styles.addText, type.sansMedium, { color: colors.inkMuted }]}>Add exercise</Text>
            </PressableScale>
          )}
        </View>

        {!live && (
          <Pressable
            accessibilityLabel="Delete session"
            onPress={() =>
              confirmDestructive("Delete this session?", effTitle, "Delete", () =>
                del.mutate(id, { onSuccess: () => router.back() }),
              )
            }
            style={styles.deleteRow}
          >
            <Trash2 size={13} color={colors.inkMuted} />
            <Text style={[styles.deleteText, type.sansMedium, { color: colors.inkMuted }]}>Delete session</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* The keypad wins the bottom while a cell is focused; else the rest bar. */}
      {focus && focusEntry ? (
        <KeyPad
          caption={`${focusEntry.name} · ${focus.field === "weight" ? unit : "reps"}`}
          draft={editStr}
          nextLabel={focus.field === "weight" ? "Next — reps" : "Done"}
          bumps={focus.field === "weight" ? (unit === "kg" ? [2.5, 5] : [5, 10]) : undefined}
          onBump={focus.field === "weight" ? bumpWeight : undefined}
          onDigit={typeDigit}
          onBackspace={backspace}
          onNext={keypadNext}
          onClose={() => setFocus(null)}
        />
      ) : (
        resting && rest && live && (
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
                <RestButton label="−15s" onPress={() => bumpRest(-15)} />
                <RestButton label="+15s" onPress={() => bumpRest(15)} />
                <RestButton label="skip" onPress={() => setRest(null)} />
              </View>
            </Panel>
          </Animated.View>
        )
      )}

      <ExercisePicker visible={picking} onAdd={addExercises} onClose={() => setPicking(false)} />
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[styles.statValue, fontStyle("fraunces", "700"), { color: tone }]}>{value}</Text>
    </View>
  );
}

/** A session control: icon only, on a wash of its own accent. Same disc the
 * live bar uses, so pause and finish read identically in both places. */
function Disc({
  label,
  tint,
  onPress,
  children,
}: {
  label: string;
  tint: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      scaleTo={0.88}
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={[styles.disc, { backgroundColor: alpha(tint, 0.14) }]}
    >
      {children}
    </PressableScale>
  );
}

function EntryThumb({ libId }: { libId?: string }) {
  const colors = usePalette();
  const ex = libraryExercise(libId);
  if (!ex) return null;
  return (
    <Image
      source={{ uri: exerciseGif(ex, 180) }}
      resizeMode="cover"
      style={[styles.entryThumb, { backgroundColor: "#ffffff", borderColor: alpha(colors.rule, 0.7) }]}
    />
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

/** One set: number · last-time ghost (or a PR flash) · weight/reps cells · the
 * log action. Default is a one-tap ✓; in an exercise's timed mode it's Start→
 * Stop. A done set that matched or beat last time washes green. */
function SetRow({
  index,
  set,
  prev,
  record,
  live,
  timed,
  running,
  focusField,
  editStr,
  onOpenCell,
  onComplete,
  onStart,
  onStop,
  onUndo,
  onRemove,
}: {
  index: number;
  set: WorkoutSet;
  prev?: WorkoutSet;
  record?: ExerciseRecord;
  live: boolean;
  timed: boolean;
  running: boolean;
  focusField: "weight" | "reps" | null;
  editStr: string;
  onOpenCell: (field: "weight" | "reps", current: number) => void;
  onComplete: () => void;
  onStart: () => void;
  onStop: () => void;
  onUndo: () => void;
  onRemove: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ghost = prev ? `${prev.weight}×${prev.reps}` : "—";
  // Did this done set match-or-beat last time, and is it a lifetime best (PR)?
  const beat = set.done && prev ? epley1RM(set.weight, set.reps) >= epley1RM(prev.weight, prev.reps) : false;
  const isPR =
    set.done && !!record && record.oneRM > 0 && epley1RM(set.weight, set.reps) > record.oneRM;

  return (
    <Pressable
      accessibilityLabel={`Set ${index + 1}`}
      onLongPress={live ? onRemove : undefined}
      style={[
        styles.setRow,
        // No prev to compare = a plain "done" green; below last time = neutral.
        set.done && { backgroundColor: alpha(!prev || beat ? colors.leaf : colors.ink, !prev || beat ? 0.16 : 0.06) },
        running && !set.done && { backgroundColor: alpha(colors.zest, 0.12) },
      ]}
    >
      <Text style={[styles.colSet, styles.setIndex, type.sansMedium, { color: colors.inkMuted }]}>
        {index + 1}
      </Text>
      <View style={styles.colPrev}>
        {isPR ? (
          <Animated.View
            entering={ZoomIn.springify().stiffness(320).damping(26)}
            style={[styles.prBadge, { backgroundColor: colors.zest }]}
          >
            <Text style={[styles.prText, type.sansSemiBold, { color: "#fff" }]}>PR</Text>
          </Animated.View>
        ) : (
          <Text numberOfLines={1} style={[styles.prevText, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
            {ghost}
          </Text>
        )}
      </View>
      <Cell
        value={set.weight}
        ghost={prev?.weight}
        focused={focusField === "weight"}
        editStr={editStr}
        editable={live}
        onPress={() => onOpenCell("weight", set.weight)}
      />
      <Cell
        value={set.reps}
        ghost={prev?.reps}
        focused={focusField === "reps"}
        editStr={editStr}
        editable={live}
        onPress={() => onOpenCell("reps", set.reps)}
      />
      <View style={styles.colAction}>
        {!live ? (
          <Text style={[styles.setIndex, type.sansMedium, { color: set.done ? colors.leaf : colors.inkMuted }]}>
            {set.done ? "✓" : ""}
          </Text>
        ) : set.done ? (
          <PressableScale scaleTo={0.8} accessibilityLabel="Undo set" onPress={onUndo} style={[styles.actionBtn, { backgroundColor: colors.leaf }]}>
            <CheckIcon size={15} color="#fff" />
          </PressableScale>
        ) : timed ? (
          running ? (
            <PressableScale scaleTo={0.85} accessibilityLabel="Stop set — start rest" onPress={onStop} style={[styles.actionBtn, { backgroundColor: colors.zest }]}>
              <Square size={12} color="#fff" fill="#fff" />
            </PressableScale>
          ) : (
            <PressableScale scaleTo={0.85} accessibilityLabel="Start set" onPress={onStart} style={[styles.actionBtn, styles.startBtn, { borderColor: colors.zest }]}>
              <Play size={13} color={colors.zest} fill={colors.zest} />
            </PressableScale>
          )
        ) : (
          <PressableScale scaleTo={0.85} accessibilityLabel="Complete set" onPress={onComplete} style={[styles.actionBtn, styles.startBtn, { borderColor: colors.leaf }]}>
            <CheckIcon size={15} color={colors.leaf} />
          </PressableScale>
        )}
      </View>
    </Pressable>
  );
}

/** A tappable value cell: shows what you're typing when focused, the stored
 * value once set, or last-time's number as a dim placeholder. */
function Cell({
  value,
  ghost,
  focused,
  editStr,
  editable,
  onPress,
}: {
  value: number;
  ghost?: number;
  focused: boolean;
  editStr: string;
  editable: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const shown = focused ? editStr : value > 0 ? String(value) : "";
  const placeholder = ghost && ghost > 0 ? String(ghost) : "—";
  return (
    <Pressable
      accessibilityLabel="Edit value"
      disabled={!editable}
      onPress={onPress}
      style={[
        styles.colInput,
        styles.cell,
        {
          backgroundColor: focused ? alpha(colors.zest, 0.14) : alpha(colors.ink, 0.05),
          borderColor: focused ? colors.zest : "transparent",
        },
      ]}
    >
      <Text
        style={[
          styles.cellText,
          type.sansSemiBold,
          { color: shown ? colors.ink : alpha(colors.inkMuted, 0.45) },
        ]}
      >
        {shown || placeholder}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  headRow: { paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { height: 40, width: 36, alignItems: "center", justifyContent: "center" },
  titleInput: { flex: 1, minWidth: 0, fontSize: 24, letterSpacing: -0.5, paddingVertical: 4 },
  headTools: { flexDirection: "row", alignItems: "center", gap: 8 },
  disc: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  stat: { gap: 2 },
  statLabel: { fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase" },
  statValue: { fontSize: 17, fontVariant: ["tabular-nums"] },
  entries: { marginTop: 16, gap: 12 },
  entryCard: { gap: 6 },
  entryHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  entryThumb: { height: 48, width: 60, borderRadius: 9, borderWidth: 1 },
  entryTitleText: { flex: 1, minWidth: 0 },
  entryName: { fontSize: 15.5, textTransform: "capitalize" },
  entryRest: { marginTop: 1, fontSize: 11.5 },
  entryRemove: { height: 28, width: 28, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  entryTools: { flexDirection: "row", alignItems: "center", gap: 2 },
  notes: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 17,
    paddingVertical: 2,
  },
  gridHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, marginTop: 4 },
  colLabel: { fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" },
  colSet: { width: 26 },
  colPrev: { flex: 1, minWidth: 0 },
  colInput: { width: 64, textAlign: "center" },
  colAction: { width: 40, alignItems: "center" },
  setRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 10 },
  setIndex: { fontSize: 12.5, fontVariant: ["tabular-nums"] },
  prevText: { fontSize: 12, fontVariant: ["tabular-nums"] },
  prBadge: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9 },
  prText: { fontSize: 10, letterSpacing: 0.8 },
  cell: {
    height: 36,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 14.5, fontVariant: ["tabular-nums"] },
  actionBtn: {
    height: 30,
    width: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtn: { backgroundColor: "transparent", borderWidth: 1.5 },
  addSet: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addSetText: { fontSize: 12.5 },
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
  addText: { fontSize: 13 },
  deleteRow: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  deleteText: { fontSize: 12 },
  restBar: { position: "absolute", left: 16, right: 16 },
  restPanel: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, paddingVertical: 10 },
  restClock: { fontSize: 22, fontVariant: ["tabular-nums"] },
  restLabel: { fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", flex: 1 },
  restTools: { flexDirection: "row", gap: 6 },
  restBtn: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  restBtnText: { fontSize: 11.5 },
});
