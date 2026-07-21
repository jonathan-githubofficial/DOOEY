import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronUp, Plus, Trash2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { useDeleteRoutine, useRoutines, useSaveRoutine } from "@/features/workouts/api";
import { ExercisePicker, type PickedExercise } from "@/features/workouts/components/ExercisePicker";
import { exerciseGif, libraryExercise } from "@/features/workouts/library";
import { useWorkoutPrefs } from "@/features/workouts/store";
import type { RoutineItem } from "@/features/workouts/types";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(400).damping(32);

// The classic splits — a routine wears one as its plan, or none.
const PLANS = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body"] as const;

/** The routine editor: name the plan, stack exercises with their set/rep/
 * weight targets, reorder, done — every change saves itself. */
export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const unit = useWorkoutPrefs((s) => s.unit);
  const { data: routines } = useRoutines();
  const save = useSaveRoutine();
  const del = useDeleteRoutine();

  const routine = routines?.find((r) => r.id === id);
  const [name, setName] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [items, setItems] = useState<RoutineItem[] | null>(null);
  const [picking, setPicking] = useState(false);

  // Hydrate local state once the routine arrives; nulls mean "not yet".
  const effName = name ?? routine?.name ?? "";
  const effGroup = group ?? routine?.group ?? "";
  const effItems = items ?? routine?.items ?? [];

  // Debounced autosave — the editor never has a save button.
  const dirty = useRef(false);
  useEffect(() => {
    if (name === null && items === null && group === null) return;
    dirty.current = true;
    const t = setTimeout(() => {
      dirty.current = false;
      save.mutate({ id, name: effName.trim() || "Routine", items: effItems, group: effGroup });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, items, group]);

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
  const addExercise = (picked: PickedExercise) => {
    setPicking(false);
    setItems([
      ...effItems,
      {
        name: picked.name,
        kind: picked.kind,
        libId: picked.libId,
        sets: 3,
        target_reps: picked.kind === "duration" ? 30 : 8,
        target_weight: 0,
      },
    ]);
  };

  const remove = () =>
    Alert.alert("Delete this routine?", effName, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => del.mutate(id, { onSuccess: () => router.back() }),
      },
    ]);

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
        <View style={styles.headRow}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Back to Gym"
            onPress={() => router.back()}
            style={styles.back}
          >
            <ChevronLeft size={22} color={colors.inkMuted} />
          </PressableScale>
          <TextInput
            value={effName}
            onChangeText={setName}
            placeholder="Routine name"
            placeholderTextColor={alpha(colors.inkMuted, 0.5)}
            style={[styles.nameInput, type.displayBlack, { color: colors.ink }]}
          />
        </View>

        <Eyebrow style={styles.section}>plan</Eyebrow>
        <View style={styles.plans}>
          {PLANS.map((p) => {
            const active = effGroup === p;
            return (
              <PressableScale
                key={p}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={`Plan ${p}`}
                onPress={() => {
                  hapticTap();
                  setGroup(active ? "" : p);
                }}
                style={[
                  styles.planChip,
                  {
                    backgroundColor: active ? alpha(colors.zest, 0.15) : colors.surface,
                    borderColor: active ? colors.zest : alpha(colors.rule, 0.8),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.planLabel,
                    type.sansMedium,
                    { color: active ? colors.ink : colors.inkMuted },
                  ]}
                >
                  {p}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Eyebrow style={styles.section}>exercises</Eyebrow>
        <View style={styles.list}>
          {effItems.map((item, i) => (
            <Animated.View key={`${item.name}-${i}`} layout={settle} entering={FadeIn.duration(160)}>
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
                    label={item.kind === "duration" ? "seconds" : "reps"}
                    value={item.target_reps}
                    min={1}
                    step={item.kind === "duration" ? 5 : 1}
                    onChange={(v) => patchItem(i, { target_reps: v })}
                  />
                  {item.kind === "weight_reps" && (
                    <WeightField
                      unit={unit}
                      value={item.target_weight}
                      onChange={(v) => patchItem(i, { target_weight: v })}
                    />
                  )}
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

      <ExercisePicker visible={picking} onPick={addExercise} onClose={() => setPicking(false)} />
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
      source={{ uri: exerciseGif(ex) }}
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

/** − n + with a tracked-caps label — targets set with taps, not typing. */
function Stepper({
  label,
  value,
  min,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.stepper}>
      <Text style={[styles.stepperLabel, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
      <View style={[styles.stepperWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
        <PressableScale
          scaleTo={0.8}
          accessibilityLabel={`Fewer ${label}`}
          onPress={() => {
            hapticTap();
            onChange(Math.max(min, value - step));
          }}
          style={styles.stepBtn}
        >
          <Text style={[styles.stepSign, type.sansMedium, { color: colors.inkMuted }]}>−</Text>
        </PressableScale>
        <Text style={[styles.stepValue, type.sansSemiBold, { color: colors.ink }]}>{value}</Text>
        <PressableScale
          scaleTo={0.8}
          accessibilityLabel={`More ${label}`}
          onPress={() => {
            hapticTap();
            onChange(value + step);
          }}
          style={styles.stepBtn}
        >
          <Text style={[styles.stepSign, type.sansMedium, { color: colors.inkMuted }]}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** Target weight — typed, since plates aren't stepped evenly. */
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
  nameInput: {
    flex: 1,
    fontSize: 26,
    letterSpacing: -0.5,
    paddingVertical: 4,
  },
  section: {
    marginTop: 20,
  },
  plans: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  planChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  planLabel: {
    fontSize: 11.5,
    letterSpacing: 0.4,
  },
  list: {
    marginTop: 10,
    gap: 10,
  },
  thumb: {
    height: 34,
    width: 44,
    borderRadius: 7,
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
  stepperWell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
  },
  stepBtn: {
    height: 34,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSign: {
    fontSize: 16,
  },
  stepValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 14.5,
    fontVariant: ["tabular-nums"],
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
