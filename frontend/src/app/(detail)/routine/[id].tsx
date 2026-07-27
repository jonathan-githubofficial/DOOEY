import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronUp, Play, Plus, Trash2, X } from "lucide-react-native";
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
import Animated, { FadeIn } from "react-native-reanimated";
import { usePagePadding } from "@/lib/shell";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import {
  useDeleteRoutine,
  useRoutines,
  useSaveRoutine,
  useStartWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { Watermark } from "@/features/workouts/components/card-parts";
import { ExercisePicker, type PickedExercise } from "@/features/workouts/components/ExercisePicker";
import { useEmblem } from "@/features/workouts/emblem";
import { focusOf, hueOf } from "@/features/workouts/focus";
import { useCardInk } from "@/features/workouts/hues";
import { exerciseGif, libraryExercise } from "@/features/workouts/library";
import { formatRest, useWorkoutPrefs } from "@/features/workouts/store";
import type { RoutineItem } from "@/features/workouts/types";
import { confirmDestructive } from "@/lib/confirm";
import { Stepper } from "@/components/stepper";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { settle } from "@/lib/motion";


/** The routine editor: name the plan, stack exercises with their set/rep/
 * weight targets, reorder, done — every change saves itself. */
export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePalette();
  const type = useType();
  const page = usePagePadding();
  const router = useRouter();
  const unit = useWorkoutPrefs((s) => s.unit);
  const defaultRest = useWorkoutPrefs((s) => s.restSeconds);
  const { data: routines } = useRoutines();
  const { data: workouts } = useWorkouts();
  const save = useSaveRoutine();
  const del = useDeleteRoutine();
  const start = useStartWorkout();
  const live = workouts?.find((w) => !w.ended_at) ?? null;

  const routine = routines?.find((r) => r.id === id);
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [items, setItems] = useState<RoutineItem[] | null>(null);
  const [picking, setPicking] = useState(false);

  // Hydrate local state once the routine arrives; nulls mean "not yet".
  const effName = name ?? routine?.name ?? "";
  const effDescription = description ?? routine?.description ?? "";
  const effItems = items ?? routine?.items ?? [];

  // The page wears the card you tapped to reach it: same colour field, same
  // drawing, same focus tag — one object at two sizes.
  const hue = hueOf({ hue: routine?.hue ?? "", items: effItems });
  const ink = useCardInk()(hue);
  const emblem = useEmblem(routine?.emblem ?? []);
  const focus = focusOf(effItems);
  const totalSets = effItems.reduce((n, it) => n + it.sets, 0);

  // Debounced autosave — the editor never has a save button.
  const dirty = useRef(false);
  useEffect(() => {
    if (name === null && items === null && description === null) return;
    dirty.current = true;
    const t = setTimeout(() => {
      dirty.current = false;
      save.mutate({
        id,
        name: effName.trim() || "Routine",
        items: effItems,
        description: effDescription.trim(),
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, items, description]);

  const patchItem = (index: number, patch: Partial<RoutineItem>) => {
    setItems(effItems.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= effItems.length) return;
    hapticTap();
    const next = [...effItems];
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
  };
  const addExercises = (picked: PickedExercise[]) => {
    setItems([
      ...effItems,
      ...picked.map((p) => ({
        name: p.name,
        kind: p.kind,
        libId: p.libId,
        sets: 3,
        target_reps: 8,
        target_weight: 0,
        rest: defaultRest,
      })),
    ]);
  };

  const startWorkout = () => {
    hapticTap();
    // One session at a time — if something's already running, jump to it.
    if (live) return router.push({ pathname: "/workout/[id]", params: { id: live.id } });
    start.mutate(
      { id, name: effName.trim() || "Routine", items: effItems },
      { onSuccess: (w) => router.push({ pathname: "/workout/[id]", params: { id: w.id } }) },
    );
  };

  const remove = () =>
    confirmDestructive(
      `Delete “${effName}”?`,
      "This removes the routine. Logged sessions stay in your history.",
      "Delete routine",
      () => del.mutate(id, { onSuccess: () => router.back() }),
    );

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      {/* Pinned above the scroller: the way back stays put while the routine
          runs under it. */}
      <View style={styles.headRow}>
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back to Gym"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.inkMuted} />
        </PressableScale>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: page.paddingBottom },
        ]}
      >
        <Panel style={[styles.hero, { backgroundColor: ink.field }]}>
          <Watermark strokes={emblem} tint={ink.mark} size={132} />
          <View style={styles.heroRow}>
            {/* A paper disc on the colour field, the same treatment the card's
                ⋯ gets — so the zest glyph reads on clay, sky or leaf alike. */}
            <PressableScale
              scaleTo={0.9}
              accessibilityLabel={live ? "Resume workout" : "Start workout"}
              disabled={start.isPending}
              onPress={startWorkout}
              style={[styles.playDisc, { backgroundColor: alpha(colors.surface, 0.85) }]}
            >
              <Play size={21} color={colors.zest} fill={colors.zest} />
            </PressableScale>
            <View style={styles.heroText}>
              <TextInput
                value={effName}
                onChangeText={setName}
                placeholder="Routine name"
                placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                style={[styles.nameInput, type.displayBlack, { color: colors.ink }]}
              />
              <TextInput
                value={effDescription}
                onChangeText={setDescription}
                placeholder="A line about what this is for…"
                placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                style={[styles.descInput, type.sans, { color: colors.inkMuted }]}
              />
            </View>
          </View>
          <View style={styles.metaRow}>
            {focus && (
              <View style={[styles.tag, { borderColor: ink.stamp }]}>
                <Text style={[styles.tagText, type.sansSemiBold, { color: ink.stamp }]}>
                  {focus.label}
                </Text>
              </View>
            )}
            <Text style={[styles.heroMeta, type.sans, { color: colors.inkMuted }]}>
              {effItems.length} {effItems.length === 1 ? "exercise" : "exercises"} · {totalSets}{" "}
              {totalSets === 1 ? "set" : "sets"}
            </Text>
          </View>
        </Panel>

        <Eyebrow style={styles.section}>exercises</Eyebrow>
        <View style={styles.list}>
          {effItems.map((item, i) => (
            <Animated.View key={`${item.name}-${i}`} layout={settle()} entering={FadeIn.duration(160)}>
              <Panel style={styles.itemCard}>
                <View style={styles.itemHead}>
                  <ItemThumb libId={item.libId} />
                  <Text numberOfLines={1} style={[styles.itemName, type.sansSemiBold, { color: colors.ink }]}>
                    {item.name}
                  </Text>
                  <View style={styles.itemTools}>
                    <IconTap label="Move up" disabled={i === 0} onPress={() => move(i, -1)}>
                      <ChevronUp size={15} color={colors.inkMuted} />
                    </IconTap>
                    <IconTap label="Move down" disabled={i === effItems.length - 1} onPress={() => move(i, 1)}>
                      <ChevronDown size={15} color={colors.inkMuted} />
                    </IconTap>
                    <IconTap label={`Remove ${item.name}`} onPress={() => setItems(effItems.filter((_, j) => j !== i))}>
                      <X size={15} color={colors.inkMuted} />
                    </IconTap>
                  </View>
                </View>
                <View style={styles.targets}>
                  <Stepper
                    label="sets"
                    value={item.sets}
                    min={1}
                    onChange={(v) => patchItem(i, { sets: v })}
                  />
                  <Stepper
                    label="reps"
                    value={item.target_reps}
                    min={1}
                    onChange={(v) => patchItem(i, { target_reps: v })}
                  />
                  <WeightField
                    unit={unit}
                    value={item.target_weight}
                    onChange={(v) => patchItem(i, { target_weight: v })}
                  />
                  <Stepper
                    label="rest"
                    value={item.rest ?? defaultRest}
                    display={formatRest(item.rest ?? defaultRest)}
                    min={15}
                    step={15}
                    onChange={(v) => patchItem(i, { rest: v })}
                  />
                </View>
              </Panel>
            </Animated.View>
          ))}

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
        </View>

        <Pressable accessibilityLabel="Delete routine" onPress={remove} style={styles.deleteRow}>
          <Trash2 size={13} color={colors.inkMuted} />
          <Text style={[styles.deleteText, type.sansMedium, { color: colors.inkMuted }]}>
            Delete routine
          </Text>
        </Pressable>
      </ScrollView>

      <ExercisePicker visible={picking} onAdd={addExercises} onClose={() => setPicking(false)} />
    </View>
  );
}

/** The exercise's demo photo, worn like a tiny polaroid on the row. */
function ItemThumb({ libId }: { libId?: string }) {
  const colors = usePalette();
  const ex = libraryExercise(libId);
  if (!ex) return null;
  return (
    <Image
      source={{ uri: exerciseGif(ex, 180) }}
      resizeMode="cover"
      style={[styles.thumb, { backgroundColor: "#ffffff", borderColor: alpha(colors.rule, 0.7) }]}
    />
  );
}

function IconTap({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      scaleTo={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconTap, disabled && { opacity: 0.3 }]}
    >
      {children}
    </PressableScale>
  );
}

function WeightField({
  unit,
  value,
  onChange,
}: {
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const [text, setText] = useState<string | null>(null);
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, type.sansMedium, { color: colors.inkMuted }]}>{unit}</Text>
      <TextInput
        value={text ?? (value > 0 ? String(value) : "")}
        onChangeText={setText}
        onEndEditing={() => {
          const v = parseFloat((text ?? "").replace(",", "."));
          onChange(Number.isFinite(v) && v > 0 ? v : 0);
          setText(null);
        }}
        placeholder="—"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        keyboardType="decimal-pad"
        selectTextOnFocus
        style={[
          styles.weightInput,
          type.sansSemiBold,
          { color: colors.ink, backgroundColor: alpha(colors.ink, 0.05) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
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
  hero: {
    marginTop: 10,
    padding: 16,
    overflow: "hidden",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  playDisc: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  nameInput: {
    fontSize: 24,
    letterSpacing: -0.5,
    paddingVertical: 2,
  },
  descInput: {
    fontSize: 13,
    paddingVertical: 1,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  tag: {
    borderWidth: 1.5,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagText: { fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase" },
  heroMeta: { fontSize: 12 },
  section: {
    marginTop: 20,
  },
  list: {
    marginTop: 10,
    gap: 10,
  },
  thumb: {
    height: 42,
    width: 52,
    borderRadius: 8,
    borderWidth: 1,
  },
  itemCard: {
    gap: 10,
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
  },
  itemTools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconTap: {
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  targets: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 14,
    flexWrap: "wrap",
  },
  stepper: {
    gap: 5,
  },
  stepperLabel: {
    fontSize: 9.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  weightInput: {
    height: 34,
    minWidth: 64,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 14.5,
    textAlign: "center",
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
});
