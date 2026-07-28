import { Plus, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DrawerHead } from "@/components/drawer-head";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { settle } from "@/lib/motion";
import { useSheetTop } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useCardInk } from "../hues";
import { CARD_HUES, type RoutineItem } from "../types";
import { ExercisePicker, type PickedExercise } from "./ExercisePicker";

/** A routine being written. `key` is local only — it keeps the list stable
 * while names are still blank and cards are being removed. */
interface Draft {
  key: number;
  name: string;
  items: RoutineItem[];
}

/** Building a program, as the deck of cards it will become. You name it, then
 * deal in a card per training day and fill each one with exercises.
 *
 * The rules are structural, not nagging: a program with no routines is an
 * empty folder, and a routine with no exercises is a name with nothing behind
 * it. Neither can be created, and the footer says which one is missing. */
export function NewProgramDeck({
  visible,
  defaultRest,
  onCreate,
  onClose,
}: {
  visible: boolean;
  defaultRest: number;
  onCreate: (program: {
    name: string;
    routines: { name: string; items: RoutineItem[] }[];
  }) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const sheetTop = useSheetTop();
  const ink = useCardInk();

  const seq = useRef(0);
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [picking, setPicking] = useState<number | null>(null);

  const reset = () => {
    seq.current = 0;
    setName("");
    setDrafts([]);
    setPicking(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const deal = () => {
    const key = ++seq.current;
    setDrafts((d) => [...d, { key, name: `Day ${d.length + 1}`, items: [] }]);
    setPicking(key);
  };
  const patch = (key: number, next: Partial<Draft>) =>
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...next } : x)));
  const discard = (key: number) => setDrafts((d) => d.filter((x) => x.key !== key));

  const addExercises = (key: number, picked: PickedExercise[]) =>
    setDrafts((d) =>
      d.map((x) =>
        x.key === key
          ? {
              ...x,
              items: [
                ...x.items,
                ...picked.map((p) => ({
                  name: p.name,
                  kind: p.kind,
                  libId: p.libId,
                  sets: 3,
                  target_reps: 8,
                  target_weight: 0,
                  rest: defaultRest,
                })),
              ],
            }
          : x,
      ),
    );

  const named = name.trim();
  const empty = drafts.filter((d) => d.items.length === 0).length;
  const blocker = !named
    ? "Name the program to continue"
    : drafts.length === 0
      ? "Add at least one routine"
      : empty > 0
        ? `${empty} routine${empty === 1 ? "" : "s"} still ${empty === 1 ? "has" : "have"} no exercises`
        : null;

  const create = () => {
    if (blocker) return;
    onCreate({
      name: named,
      routines: drafts.map((d, i) => ({ name: d.name.trim() || `Day ${i + 1}`, items: d.items })),
    });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.sheet, { backgroundColor: colors.paper, paddingTop: sheetTop }]}>
        <Grain />
        <DrawerHead
          eyebrow="new program"
          onCancel={close}
          cancelLabel="Discard this program"
          onConfirm={create}
          confirmLabel="Create program"
          confirmDisabled={!!blocker}
          style={styles.head}
        />
        {/* The blocker rides under the tick rather than beside a footer
            button: it is the reason that corner is dim. */}
        {!!blocker && (
          <Text style={[styles.blocker, type.sans, { color: colors.inkMuted }]}>{blocker}</Text>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 120 }]}
        >
          <Panel style={styles.namePanel}>
            <Eyebrow>call it</Eyebrow>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Upper / Lower"
              placeholderTextColor={alpha(colors.inkMuted, 0.5)}
              style={[styles.nameInput, type.displayBlack, { color: colors.ink }]}
            />
          </Panel>

          <Eyebrow style={styles.deckHead}>
            {drafts.length === 0
              ? "the days"
              : `${drafts.length} ${drafts.length === 1 ? "routine" : "routines"}`}
          </Eyebrow>

          {drafts.map((d, i) => {
            const shade = ink(CARD_HUES[i % CARD_HUES.length]);
            return (
              <Animated.View key={d.key} layout={settle()} entering={FadeIn.duration(180)}>
                <Panel style={[styles.card, { backgroundColor: shade.field }]}>
                  <View style={styles.cardHead}>
                    <TextInput
                      value={d.name}
                      onChangeText={(v) => patch(d.key, { name: v })}
                      placeholder={`Day ${i + 1}`}
                      placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                      style={[styles.cardName, type.display, { color: colors.ink }]}
                    />
                    <Pressable
                      accessibilityLabel={`Remove ${d.name}`}
                      hitSlop={10}
                      onPress={() => discard(d.key)}
                      style={[styles.drop, { backgroundColor: alpha(colors.surface, 0.7) }]}
                    >
                      <X size={14} color={colors.inkMuted} />
                    </Pressable>
                  </View>

                  {d.items.length > 0 && (
                    <Text
                      numberOfLines={2}
                      style={[styles.cardList, type.sans, { color: colors.inkMuted }]}
                    >
                      {d.items.map((it) => it.name).join(", ")}
                    </Text>
                  )}

                  <PressableScale
                    scaleTo={0.97}
                    accessibilityLabel={`Add exercises to ${d.name}`}
                    onPress={() => setPicking(d.key)}
                    style={[styles.addExs, { borderColor: shade.stamp }]}
                  >
                    <Plus size={14} color={shade.stamp} />
                    <Text style={[styles.addExsText, type.sansSemiBold, { color: shade.stamp }]}>
                      {d.items.length === 0
                        ? "Add exercises"
                        : `${d.items.length} ${d.items.length === 1 ? "exercise" : "exercises"}`}
                    </Text>
                  </PressableScale>
                </Panel>
              </Animated.View>
            );
          })}

          <PressableScale
            scaleTo={0.98}
            accessibilityLabel="Add a routine"
            onPress={deal}
            style={[styles.deal, { borderColor: alpha(colors.rule, 0.9) }]}
          >
            <Plus size={16} color={colors.inkMuted} />
            <Text style={[styles.dealText, type.sansMedium, { color: colors.inkMuted }]}>
              {drafts.length === 0 ? "Add a routine" : "Add another"}
            </Text>
          </PressableScale>
        </ScrollView>

      </View>

      <ExercisePicker
        visible={picking !== null}
        onAdd={(picked) => {
          if (picking !== null) addExercises(picking, picked);
        }}
        onClose={() => setPicking(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 16 },
  head: { marginBottom: 2 },
  body: { paddingTop: 14, gap: 10 },
  namePanel: { padding: 16, gap: 2 },
  nameInput: { fontSize: 24, letterSpacing: -0.5, paddingVertical: 3 },
  deckHead: { marginTop: 12, marginBottom: 2 },
  card: { padding: 14, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardName: { flex: 1, fontSize: 18, letterSpacing: -0.3, paddingVertical: 2 },
  drop: { height: 26, width: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  cardList: { marginTop: 4, fontSize: 12 },
  addExs: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  addExsText: { fontSize: 12 },
  deal: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 18,
    paddingVertical: 20,
  },
  dealText: { fontSize: 14 },
  blocker: { marginTop: 8, fontSize: 12 },
});
