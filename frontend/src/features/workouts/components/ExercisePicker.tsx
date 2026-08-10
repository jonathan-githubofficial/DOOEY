import { ChevronLeft, Info } from "lucide-react-native";
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
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSheetTop } from "@/lib/shell";
import { DrawerHead } from "@/components/drawer-head";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { useElevation, usePalette, useType } from "@/stores/theme";
import {
  exerciseGif,
  exerciseMuscles,
  GIF_PAPER,
  kindOf,
  libraryExercise,
  MUSCLE_GROUPS,
  prettyName,
  searchLibrary,
  type LibraryExercise,
} from "../library";
import type { ExerciseKind } from "../types";
import { MuscleMap } from "./MuscleMap";

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
  const sheetTop = useSheetTop();
  const [query, setQuery] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<LibraryExercise | null>(null);

  const trimmed = query.trim();
  // A search cuts across everything; otherwise you're inside the opened muscle
  // group — or browsing the groups themselves, when neither is set.
  const matches = useMemo(() => {
    if (trimmed) return searchLibrary(query, "all");
    if (openGroup) return searchLibrary("", openGroup);
    return [];
  }, [query, trimmed, openGroup]);
  const browsingGroups = !trimmed && !openGroup;

  // Each muscle group with its exercise count — the card art is the muscle map.
  const groupsData = useMemo(
    () =>
      MUSCLE_GROUPS.filter((g) => g.key !== "all").map((g) => ({
        key: g.key,
        label: g.label,
        count: searchLibrary("", g.key).length,
      })),
    [],
  );
  const openLabel = MUSCLE_GROUPS.find((g) => g.key === openGroup)?.label ?? "";

  const isNew =
    !!onAdd &&
    trimmed.length > 1 &&
    !matches.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  const reset = () => {
    setSelected(new Set());
    setQuery("");
    setOpenGroup(null);
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
      return ex ? [{ name: prettyName(ex.name), kind: kindOf(), libId: ex.id }] : [];
    });
    onAdd(picks);
    reset();
    onClose();
  };

  const addCustom = () => {
    onAdd?.([{ name: trimmed, kind: "weight_reps" }]);
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
      onRequestClose={() =>
        detail ? setDetail(null) : openGroup && !trimmed ? setOpenGroup(null) : close()
      }
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.paper, paddingTop: sheetTop },
        ]}
      >
        <Grain />
        {/* The count rides in the eyebrow rather than on a second button:
            the tick already says "add", and what changes as you pick is how
            many, not what the corner does. */}
        <DrawerHead
          eyebrow={
            !onAdd
              ? "exercise library"
              : selected.size > 0
                ? `${selected.size} picked`
                : "add exercises"
          }
          onCancel={close}
          cancelLabel="Close the library"
          onConfirm={onAdd && selected.size > 0 ? commit : undefined}
          confirmLabel={`Add ${selected.size} ${selected.size === 1 ? "exercise" : "exercises"}`}
          style={styles.head}
        />

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

        {isNew && (
          <View style={styles.customRow}>
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

        {browsingGroups ? (
          <FlatList
            data={groupsData}
            keyExtractor={(g) => g.key}
            numColumns={2}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.groupGridRow}
            contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + (onAdd ? 96 : 24) }]}
            renderItem={({ item }) => (
              <GroupCard
                group={item}
                onPress={() => {
                  hapticTap();
                  setOpenGroup(item.key);
                }}
              />
            )}
          />
        ) : (
          <>
            {openGroup && !trimmed && (
              <PressableScale
                scaleTo={0.98}
                accessibilityLabel="Back to muscle groups"
                onPress={() => setOpenGroup(null)}
                style={styles.backRow}
              >
                <ChevronLeft size={18} color={colors.inkMuted} />
                <Text numberOfLines={1} style={[styles.backText, type.display, { color: colors.ink }]}>
                  {openLabel}
                </Text>
                <Text style={[styles.backCount, type.sans, { color: colors.inkMuted }]}>
                  {matches.length}
                </Text>
              </PressableScale>
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
          </>
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

/** A muscle group as a board-style card: the anatomical figure with this
 * group's muscle lit (male/female per prefs), the group name, and how many
 * exercises it holds. Tapping opens the group. */
function GroupCard({
  group,
  onPress,
}: {
  group: { key: string; label: string; count: number };
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const elevation = useElevation();
  return (
    <PressableScale
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={`${group.label}, ${group.count} exercises`}
      onPress={onPress}
      style={[
        styles.groupCard,
        elevation,
        { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
      ]}
    >
      <Grain radius={9} />
      <View style={[styles.groupCardThumb, { backgroundColor: alpha(colors.ink, 0.04) }]}>
        <MuscleMap targets={[group.key]} scale={0.3} />
      </View>
      <Text numberOfLines={1} style={[styles.groupCardName, type.display, { color: colors.ink }]}>
        {group.label}
      </Text>
      <Text style={[styles.groupCardCount, type.sans, { color: colors.inkMuted }]}>
        {group.count} exercises
      </Text>
    </PressableScale>
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
  const elevation = useElevation();
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
        elevation,
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
        style={[styles.tilePhoto, { backgroundColor: GIF_PAPER }]}
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
          <Text style={[styles.tileCheckMark, { color: colors.paper }]}>✓</Text>
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
  const radius = useCardRadius();
  const insets = useSafeAreaInsets();
  const { primary, secondary } = exerciseMuscles(exercise);
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
            style={styles.detailBack}
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
            {
              borderRadius: radius,
              backgroundColor: colors.surface,
              borderColor: alpha(colors.rule, 0.7),
            },
          ]}
        >
          <Image source={{ uri: exerciseGif(exercise) }} resizeMode="contain" style={styles.detailGif} />
        </View>

        <View style={styles.anatomy}>
          <MuscleMap targets={primary} secondary={secondary} both scale={0.5} />
          <View style={styles.anatomyChips}>
            {/* What it's for reads solid; what it also works is outlined, the
                same distinction the figure beside it is making. */}
            {primary.map((m) => (
              <View key={m} style={[styles.muscleChip, { backgroundColor: alpha(colors.clay, 0.12) }]}>
                <Text style={[styles.muscleText, type.sansMedium, { color: colors.clay }]}>{m}</Text>
              </View>
            ))}
            {secondary.map((m) => (
              <View
                key={m}
                style={[styles.muscleChip, styles.muscleChipAlso, { borderColor: alpha(colors.clay, 0.35) }]}
              >
                <Text style={[styles.muscleText, type.sansMedium, { color: alpha(colors.ink, 0.55) }]}>
                  {m}
                </Text>
              </View>
            ))}
            {exercise.equip.map((m) => (
              <View key={m} style={[styles.muscleChip, { backgroundColor: alpha(colors.ink, 0.06) }]}>
                <Text style={[styles.muscleText, type.sansMedium, { color: colors.inkMuted }]}>{m}</Text>
              </View>
            ))}
          </View>
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

/** The same exercise page the library shows, on its own, for anywhere outside
 * the picker that has a `libId` and a reason to show it — the session log's
 * thumbnails, mainly. Renders nothing for an exercise that isn't in the
 * library, which is how a hand-typed exercise ends up with no page. */
export function ExerciseSheet({ libId, onClose }: { libId?: string; onClose: () => void }) {
  const exercise = libraryExercise(libId);
  if (!exercise) return null;
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <ExerciseDetail exercise={exercise} selected={false} onBack={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 16,
  },
  head: {
    marginBottom: 2,
  },
  detailBack: {
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
  groupGridRow: {
    gap: 12,
    marginBottom: 12,
  },
  groupCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    paddingBottom: 10,
  },
  groupCardThumb: {
    height: 132,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  groupCardName: {
    marginTop: 8,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  groupCardCount: {
    marginTop: 1,
    fontSize: 11,
  },
  backRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  backText: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  backCount: {
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  customRow: {
    marginTop: 12,
    gap: 8,
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
    alignSelf: "center",
    // The source loops are 180×180 — stretching them full-width just blurs
    // them. Cap near native size so they stay crisp.
    width: 240,
    maxWidth: "100%",
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: GIF_PAPER,
  },
  detailGif: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: GIF_PAPER,
  },
  anatomy: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  anatomyChips: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    alignContent: "center",
  },
  muscleChip: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  muscleChipAlso: {
    borderWidth: 1,
    paddingVertical: 4,
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
