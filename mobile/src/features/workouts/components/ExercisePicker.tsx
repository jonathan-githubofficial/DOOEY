import { ChevronLeft, Dumbbell, Hash, Timer, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
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

/** The exercise library: 1,500 exercises, each demonstrated by an animated
 * 3D model with the working muscle lit — browsed under push/pull/legs lenses.
 * Tap to add (pick mode) or to open the how-to; long-press always opens it.
 * Naming something unknown adds it as your own. */
export function ExercisePicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick?: (picked: PickedExercise) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<LibraryGroup>("all");
  const [kind, setKind] = useState<ExerciseKind>("weight_reps");
  const [detail, setDetail] = useState<LibraryExercise | null>(null);

  const matches = useMemo(() => searchLibrary(query, group), [query, group]);
  const trimmed = query.trim();
  const isNew =
    !!onPick &&
    trimmed.length > 1 &&
    !matches.some((e) => e.name.toLowerCase() === trimmed.toLowerCase());

  const pick = (picked: PickedExercise) => {
    hapticTap();
    onPick?.(picked);
    setQuery("");
    setDetail(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={() => (detail ? setDetail(null) : onClose())}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.paper, paddingTop: Platform.OS === "ios" ? 14 : insets.top + 14 },
        ]}
      >
        <Grain />
        <View style={styles.head}>
          <Eyebrow>exercise library</Eyebrow>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Close the library"
            onPress={onClose}
            style={styles.close}
          >
            <X size={18} color={colors.inkMuted} />
          </PressableScale>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={onPick ? "Search 1,500 exercises — or name your own" : "Search 1,500 exercises"}
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
              onPress={() => pick({ name: trimmed, kind })}
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
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          renderItem={({ item, index }) => (
            <ExerciseTile
              exercise={item}
              index={index}
              onPress={() =>
                onPick ? pick({ name: item.name, kind: kindOf(item), libId: item.id }) : setDetail(item)
              }
              onLongPress={() => setDetail(item)}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
              {onPick
                ? "Nothing here by that name — keep typing to add it as your own."
                : "Nothing here by that name."}
            </Text>
          }
        />

        {detail && (
          <ExerciseDetail
            exercise={detail}
            onAdd={onPick && (() => pick({ name: detail.name, kind: kindOf(detail), libId: detail.id }))}
            onBack={() => setDetail(null)}
          />
        )}
      </View>
    </Modal>
  );
}

/** A little moving polaroid, like the board tiles: the demo loop on a paper
 * card with a caption, each hung slightly off-straight. */
function ExerciseTile({
  exercise,
  index,
  onPress,
  onLongPress,
}: {
  exercise: LibraryExercise;
  index: number;
  onPress: () => void;
  onLongPress: () => void;
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
      onLongPress={onLongPress}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: alpha(colors.rule, 0.7),
          transform: [{ rotate: lean }],
        },
      ]}
    >
      <Grain radius={10} />
      <Image
        source={{ uri: exerciseGif(exercise) }}
        resizeMode="cover"
        style={[styles.tilePhoto, { backgroundColor: "#ffffff" }]}
      />
      <Text numberOfLines={2} style={[styles.tileName, type.sansMedium, { color: colors.ink }]}>
        {exercise.name}
      </Text>
      <Text numberOfLines={1} style={[styles.tileMuscle, type.sans, { color: colors.inkMuted }]}>
        {exercise.targets[0] ?? exercise.parts[0]}
      </Text>
    </PressableScale>
  );
}

/** The how-to: the model demonstrating on a loop, the muscles it works, and
 * the steps — Hevy's exercise page, on paper. */
function ExerciseDetail({
  exercise,
  onAdd,
  onBack,
}: {
  exercise: LibraryExercise;
  onAdd?: () => void;
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
            {exercise.name}
          </Text>
        </View>

        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <Image
            source={{ uri: exerciseGif(exercise) }}
            resizeMode="contain"
            style={styles.detailGif}
          />
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

        {onAdd && (
          <View style={styles.detailAdd}>
            <Plate label="Add exercise" onPress={onAdd} style={styles.detailPlate} />
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
  tilePhoto: {
    width: "100%",
    aspectRatio: 1.1,
    borderRadius: 7,
  },
  tileName: {
    marginTop: 6,
    fontSize: 10.5,
    lineHeight: 13,
    textTransform: "capitalize",
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
    textTransform: "capitalize",
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
