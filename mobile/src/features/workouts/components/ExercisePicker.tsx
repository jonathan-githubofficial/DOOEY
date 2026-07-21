import { ChevronLeft, Dumbbell, Hash, Info, Timer, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow } from "@/components/surface";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import {
  exerciseGif,
  GROUPS,
  kindOf,
  libraryExercise,
  prettyName,
  searchLibrary,
  type LibraryExercise,
  type LibraryGroup,
} from "../library";
import type { ExerciseKind } from "../types";

const KINDS: { key: ExerciseKind; label: string; icon: typeof Dumbbell }[] = [
  { key: "weight_reps", label: "weight × reps", icon: Dumbbell },
  { key: "reps", label: "reps only", icon: Hash },
  { key: "duration", label: "timed", icon: Timer },
];

export interface PickedExercise {
  name: string;
  kind: ExerciseKind;
  libId?: string;
}

/** The exercise library: 1,500 exercises, each demonstrated by an animated 3D
 * model with the working muscle lit. In pick mode you tap tiles to select
 * several and add them all at once; the ⓘ dot (or long-press) opens the
 * how-to. Naming something unknown adds it as your own. Without `onAdd` it's
 * pure reference (Explore). */
export function ExercisePicker({
  visible,
  onAdd,
  onClose,
}: {
  visible: boolean;
  onAdd?: (picked: PickedExercise[]) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<LibraryGroup>("all");
  const [kind, setKind] = useState<ExerciseKind>("weight_reps");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<LibraryExercise | null>(null);

  const matches = useMemo(() => searchLibrary(query, group), [query, group]);
  const trimmed = query.trim();
  const isNew =
    !!onAdd &&
    trimmed.length > 1 &&
    !matches.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  const reset = () => {
    setSelected(new Set());
    setQuery("");
    setDetail(null);
  };

  const toggle = (ex: LibraryExercise) => {
    hapticTap();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.add(ex.id);
      return next;
    });
  };

  const commit = () => {
    if (!onAdd || selected.size === 0) return;
    const picks: PickedExercise[] = [...selected].flatMap((id) => {
      const ex = libraryExercise(id);
      return ex ? [{ name: prettyName(ex.name), kind: kindOf(ex), libId: ex.id }] : [];
    });
    onAdd(picks);
    reset();
    onClose();
  };

  const addCustom = () => {
    onAdd?.([{ name: trimmed, kind }]);
    reset();
    onClose();
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={() => (detail ? setDetail(null) : close())}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.paper, paddingTop: Platform.OS === "ios" ? 14 : insets.top + 14 },
        ]}
      >
        <Grain />
        <View style={styles.head}>
          <Eyebrow>{onAdd ? "add exercises" : "exercise library"}</Eyebrow>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Close the library"
            onPress={close}
            style={styles.close}
          >
            <X size={18} color={colors.inkMuted} />
          </PressableScale>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={onAdd ? "Search 1,500 exercises — or name your own" : "Search 1,500 exercises"}
          placeholderTextColor={alpha(colors.inkMuted, 0.5)}
          autoCorrect={false}
          style={[
            styles.search,
            type.sans,
            { color: colors.ink, borderBottomColor: alpha(colors.ink, 0.18) },
          ]}
        />

        <View style={styles.groups}>
          {GROUPS.map((g) => {
            const active = group === g;
            return (
              <PressableScale
                key={g}
                scaleTo={0.92}
                accessibilityRole="button"
                accessibilityLabel={`${g} exercises`}
                onPress={() => {
                  hapticTap();
                  setGroup(g);
                }}
                style={[
                  styles.groupChip,
                  {
                    backgroundColor: active ? alpha(colors.zest, 0.15) : colors.surface,
                    borderColor: active ? colors.zest : alpha(colors.rule, 0.8),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.groupLabel,
                    type.sansMedium,
                    { color: active ? colors.ink : colors.inkMuted },
                  ]}
                >
                  {g}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {isNew && (
          <View style={styles.customRow}>
            <View style={styles.kinds}>
              {KINDS.map((k) => {
                const active = kind === k.key;
                const Icon = k.icon;
                return (
                  <PressableScale
                    key={k.key}
                    scaleTo={0.92}
                    accessibilityRole="button"
                    accessibilityLabel={k.label}
                    onPress={() => setKind(k.key)}
                    style={[
                      styles.kindChip,
                      {
                        backgroundColor: active ? alpha(colors.zest, 0.15) : colors.surface,
                        borderColor: active ? colors.zest : alpha(colors.rule, 0.8),
                      },
                    ]}
                  >
                    <Icon size={12} color={active ? colors.zest : colors.inkMuted} />
                    <Text
                      style={[
                        styles.kindLabel,
                        type.sansMedium,
                        { color: active ? colors.ink : colors.inkMuted },
                      ]}
                    >
                      {k.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
            <PressableScale
              scaleTo={0.97}
              accessibilityLabel={`Add ${trimmed}`}
              onPress={addCustom}
              style={[styles.create, { backgroundColor: alpha(colors.zest, 0.12) }]}
            >
              <Text style={[styles.createText, type.sansMedium, { color: colors.ink }]}>
                Add “{trimmed}” as your own
              </Text>
            </PressableScale>
          </View>
        )}

        <FlatList
          data={matches}
          keyExtractor={(e) => e.id}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + (onAdd ? 96 : 24) }]}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          renderItem={({ item, index }) => (
            <ExerciseTile
              exercise={item}
              index={index}
              picking={!!onAdd}
              selected={selected.has(item.id)}
              onPress={() => (onAdd ? toggle(item) : setDetail(item))}
              onInfo={() => setDetail(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
              {onAdd
                ? "Nothing here by that name — keep typing to add it as your own."
                : "Nothing here by that name."}
            </Text>
          }
        />

        {/* The batch bar — rides in once something's picked. */}
        {onAdd && selected.size > 0 && (
          <Animated.View
            entering={SlideInDown.springify().stiffness(300).damping(28)}
            style={[styles.addBar, { paddingBottom: insets.bottom + 12 }]}
          >
            <Plate
              label={`Add ${selected.size} ${selected.size === 1 ? "exercise" : "exercises"}`}
              onPress={commit}
              style={styles.addBarPlate}
            />
          </Animated.View>
        )}

        {detail && (
          <ExerciseDetail
            exercise={detail}
            selected={selected.has(detail.id)}
            onToggle={onAdd ? () => toggle(detail) : undefined}
            onBack={() => setDetail(null)}
          />
        )}
      </View>
    </Modal>
  );
}

/** A little moving polaroid, like the board tiles: the demo loop on a paper
 * card with a caption. In pick mode a tap selects it (a check drops on); the
 * ⓘ dot opens the how-to. */
function ExerciseTile({
  exercise,
  index,
  picking,
  selected,
  onPress,
  onInfo,
}: {
  exercise: LibraryExercise;
  index: number;
  picking: boolean;
  selected: boolean;
  onPress: () => void;
  onInfo: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const lean = index % 3 === 0 ? "-1.2deg" : index % 3 === 1 ? "0.9deg" : "-0.5deg";
  return (
    <PressableScale
      scaleTo={0.93}
      accessibilityRole="button"
      accessibilityLabel={exercise.name}
      onPress={onPress}
      onLongPress={onInfo}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.zest : alpha(colors.rule, 0.7),
          transform: [{ rotate: lean }],
        },
        selected && styles.tileSelected,
      ]}
    >
      <Grain radius={10} />
      <Image
        source={{ uri: exerciseGif(exercise) }}
        resizeMode="cover"
        style={[styles.tilePhoto, { backgroundColor: "#ffffff" }]}
      />
      {/* The ⓘ dot — how-to without leaving your selection. */}
      <Pressable
        accessibilityLabel={`How to do ${exercise.name}`}
        hitSlop={8}
        onPress={onInfo}
        style={[styles.infoDot, { backgroundColor: alpha(colors.paper, 0.9) }]}
      >
        <Info size={12} color={colors.ink} />
      </Pressable>
      {picking && selected && (
        <View style={[styles.tileCheck, { backgroundColor: colors.zest }]}>
          <Text style={styles.tileCheckMark}>✓</Text>
        </View>
      )}
      <Text numberOfLines={2} style={[styles.tileName, type.sansMedium, { color: colors.ink }]}>
        {prettyName(exercise.name)}
      </Text>
      <Text numberOfLines={1} style={[styles.tileMuscle, type.sans, { color: colors.inkMuted }]}>
        {exercise.targets[0] ?? exercise.parts[0]}
      </Text>
    </PressableScale>
  );
}

/** The how-to: the model demonstrating on a loop, the muscles it works, and
 * the steps. Can toggle selection right from here in pick mode. */
function ExerciseDetail({
  exercise,
  selected,
  onToggle,
  onBack,
}: {
  exercise: LibraryExercise;
  selected: boolean;
  onToggle?: () => void;
  onBack: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]}
    >
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.detail, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.detailHead}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Back to the library"
            onPress={onBack}
            style={styles.close}
          >
            <ChevronLeft size={20} color={colors.inkMuted} />
          </PressableScale>
          <Text style={[styles.detailName, type.display, { color: colors.ink }]}>
            {prettyName(exercise.name)}
          </Text>
        </View>

        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <Image source={{ uri: exerciseGif(exercise) }} resizeMode="contain" style={styles.detailGif} />
        </View>

        <View style={styles.muscleRow}>
          {[...exercise.targets, ...exercise.equip].map((m) => (
            <View key={m} style={[styles.muscleChip, { backgroundColor: alpha(colors.clay, 0.12) }]}>
              <Text style={[styles.muscleText, type.sansMedium, { color: colors.clay }]}>{m}</Text>
            </View>
          ))}
        </View>

        <Eyebrow style={styles.stepsHead}>how to</Eyebrow>
        {exercise.steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={[styles.stepNum, type.sansSemiBold, { color: colors.zest }]}>{i + 1}</Text>
            <Text style={[styles.stepText, type.sans, { color: colors.ink }]}>
              {s.replace(/^Step:\d+\s*/, "")}
            </Text>
          </View>
        ))}

        {onToggle && (
          <View style={styles.detailAdd}>
            <Plate
              label={selected ? "Selected ✓ — tap to remove" : "Select exercise"}
              onPress={() => {
                onToggle();
                onBack();
              }}
              style={styles.detailPlate}
            />
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 16,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  close: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    marginTop: 6,
    borderBottomWidth: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  groups: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  groupChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  groupLabel: {
    fontSize: 11.5,
    letterSpacing: 0.5,
    textTransform: "capitalize",
  },
  customRow: {
    marginTop: 12,
    gap: 8,
  },
  kinds: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  kindLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  create: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  createText: {
    fontSize: 13.5,
  },
  grid: {
    paddingTop: 14,
  },
  gridRow: {
    gap: 10,
    marginBottom: 12,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    paddingBottom: 8,
    shadowColor: "#282018",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tileSelected: {
    borderWidth: 2,
    padding: 5,
    paddingBottom: 7,
  },
  tilePhoto: {
    width: "100%",
    aspectRatio: 1.1,
    borderRadius: 7,
  },
  infoDot: {
    position: "absolute",
    top: 10,
    left: 10,
    height: 22,
    width: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tileCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    height: 22,
    width: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tileCheckMark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  tileName: {
    marginTop: 6,
    fontSize: 10.5,
    lineHeight: 13,
  },
  tileMuscle: {
    marginTop: 2,
    fontSize: 9,
    textTransform: "capitalize",
  },
  empty: {
    paddingVertical: 28,
    fontSize: 12.5,
    textAlign: "center",
  },
  addBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
  },
  addBarPlate: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 15,
  },
  detail: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  detailHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailName: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  detailCard: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  detailGif: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
  },
  muscleRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  muscleChip: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  muscleText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  stepsHead: {
    marginTop: 20,
  },
  stepRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  stepNum: {
    width: 18,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  stepText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
  detailAdd: {
    marginTop: 24,
  },
  detailPlate: {
    alignSelf: "stretch",
    borderRadius: 14,
    paddingVertical: 15,
  },
});
