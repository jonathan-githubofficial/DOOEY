import { Check, Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleEditor } from "@/components/DoodleEditor";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, StampButton } from "@/components/surface";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDesignRoutine } from "../api";
import { cardAir } from "../card-metrics";
import { focusOf } from "../focus";
import { useCardInk } from "../hues";
import { CARD_HUES, type CardHue, type Routine } from "../types";
import { useEmblem } from "../emblem";
import { CardFace, Watermark } from "./card-parts";

/** Make a routine's card yours: pick its colour, draw its mark. Both start
 * automatic — the colour of what it trains, and your gym doodle — so this is
 * somewhere to go when you want to, never a step you must complete. */
export function CardDesigner({
  routine,
  onClose,
}: {
  routine: Routine;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const design = useDesignRoutine();

  const [hue, setHue] = useState<CardHue | "">(routine.hue);
  const [emblem, setEmblem] = useState<Stroke[]>(routine.emblem);
  const [drawing, setDrawing] = useState(false);

  const auto = focusOf(routine.items)?.hueKey ?? "zest";
  const shown: CardHue = hue || auto;
  const ink = useCardInk()(shown);
  const preview = useEmblem(emblem);
  const count = routine.items.length;

  const save = () => {
    design.mutate({ id: routine.id, hue, emblem });
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: alpha(colors.ink, 0.45) }]}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Panel style={styles.sheet}>
            <Eyebrow>design this card</Eyebrow>

            <View style={[styles.preview, { backgroundColor: ink.field }]}>
              <Watermark strokes={preview} tint={ink.mark} size={104} />
              <CardFace
                hue={shown}
                air={cardAir(count)}
                title={routine.name}
                meta={`${count} ${count === 1 ? "exercise" : "exercises"}`}
                tag={focusOf(routine.items)?.label ?? null}
              />
            </View>

            <Text style={[type.sansMedium, styles.label, { color: colors.inkMuted }]}>Colour</Text>
            <View style={styles.swatches}>
              <ColorTile
                label="Auto"
                color={colors[auto]}
                selected={hue === ""}
                dashed
                onPress={() => setHue("")}
              />
              {CARD_HUES.map((h) => (
                <ColorTile
                  key={h}
                  label={h}
                  color={colors[h]}
                  selected={hue === h}
                  onPress={() => setHue(h)}
                />
              ))}
            </View>

            <Text style={[type.sansMedium, styles.label, { color: colors.inkMuted }]}>Mark</Text>
            <View style={styles.markRow}>
              <PressableScale
                scaleTo={0.97}
                accessibilityLabel="Draw this card's mark"
                onPress={() => setDrawing(true)}
                style={[styles.markBtn, { borderColor: alpha(colors.rule, 0.9) }]}
              >
                <Pencil size={15} color={colors.ink} />
                <Text style={[type.sansMedium, styles.markText, { color: colors.ink }]}>
                  {emblem.length > 0 ? "Redraw" : "Draw one"}
                </Text>
              </PressableScale>
              {emblem.length > 0 && (
                <PressableScale
                  scaleTo={0.97}
                  accessibilityLabel="Clear this card's mark"
                  onPress={() => setEmblem([])}
                  style={[styles.markBtn, { borderColor: alpha(colors.rule, 0.9) }]}
                >
                  <Trash2 size={15} color={colors.inkMuted} />
                  <Text style={[type.sansMedium, styles.markText, { color: colors.inkMuted }]}>
                    Clear
                  </Text>
                </PressableScale>
              )}
            </View>
            <Text style={[type.sans, styles.hint, { color: colors.inkMuted }]}>
              {emblem.length > 0 ? "Your drawing." : "Using your gym doodle until you draw one."}
            </Text>

            <View style={styles.actions}>
              <Pressable accessibilityLabel="Cancel" hitSlop={8} onPress={onClose}>
                <Text style={[type.sansMedium, styles.cancel, { color: colors.inkMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <StampButton color={ink.stamp} onPress={save} style={styles.done}>
                <Check size={15} color={ink.field} />
                <Text style={[type.sansSemiBold, styles.doneText, { color: ink.field }]}>Done</Text>
              </StampButton>
            </View>
          </Panel>

          {drawing && (
            <Animated.View entering={FadeIn.duration(160)} style={styles.editor}>
              <DoodleEditor
                heading={`${routine.name} mark`}
                initial={emblem}
                onClose={() => setDrawing(false)}
                onSave={(strokes) => {
                  setEmblem(strokes);
                  setDrawing(false);
                }}
              />
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ColorTile({
  label,
  color,
  selected,
  dashed,
  onPress,
}: {
  label: string;
  color: string;
  selected: boolean;
  dashed?: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      scaleTo={0.9}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.swatch,
        { backgroundColor: dashed ? "transparent" : color },
        dashed && { borderWidth: 1.5, borderStyle: "dashed", borderColor: color },
        selected && { borderWidth: 2.5, borderStyle: "solid", borderColor: colors.ink },
      ]}
    >
      {selected && <Check size={15} color={dashed ? colors.ink : colors.surface} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 18, gap: 14 },
  sheet: { padding: 18, gap: 0 },
  preview: { borderRadius: 16, padding: 14, marginTop: 12, overflow: "hidden" },
  label: { fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase", marginTop: 18 },
  swatches: { flexDirection: "row", gap: 10, marginTop: 10 },
  swatch: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  markRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  markBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  markText: { fontSize: 13 },
  hint: { fontSize: 11.5, marginTop: 8 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 18, marginTop: 22 },
  cancel: { fontSize: 14 },
  done: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  doneText: { fontSize: 13, letterSpacing: 2.4, textTransform: "uppercase" },
  editor: { alignSelf: "stretch" },
});
