import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Key, Panel, StampButton } from "@/components/surface";
import { useCardInk } from "@/features/workouts/hues";
import { CARD_HUES, type CardHue } from "@/features/workouts/types";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useCreateTracker } from "../api";
import { SHAPES, SHAPE_SPEC, defaultsFor, type Shape } from "../types";

/** How many steps a scale may run to. Past ten the row stops being a row of
 * choices and becomes a number pad, which is a different control. */
const SCALE_MAX = 10;

/** Deciding to keep something new.
 *
 * Three questions, and the middle one is answered by example rather than by
 * definition: nobody knows what "a scale" is until they read "mood, 4 out of 5".
 * It unfolds in place under the strip instead of taking over the screen, so you
 * can see what you already track while you add to it. */
export function NewTrackerForm({ onDone }: { onDone: () => void }) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const create = useCreateTracker();

  const [name, setName] = useState("");
  const [shape, setShape] = useState<Shape>("text");
  const [hue, setHue] = useState<CardHue>("sky");
  const [unit, setUnit] = useState("");
  const [max, setMax] = useState(5);

  const spec = SHAPE_SPEC[shape];
  const ready = name.trim().length > 0 && !create.isPending;

  const pickShape = (next: Shape) => {
    hapticTap();
    setShape(next);
    // The unit follows the shape unless it has already been typed over.
    setUnit(defaultsFor(next).unit);
  };

  const submit = () => {
    if (!ready) return;
    hapticTap();
    create.mutate(
      {
        name: name.trim(),
        shape,
        hue,
        unit: spec.unit ? unit.trim() : "",
        min: spec.range ? 1 : 0,
        max: spec.range ? max : 0,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <Panel style={styles.panel}>
      <Eyebrow>track something new</Eyebrow>
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder="Sleep"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        accessibilityLabel="What to call it"
        style={[styles.name, type.display, { color: colors.ink }]}
      />

      <Eyebrow style={styles.head}>what you put in</Eyebrow>
      <View style={styles.shapes}>
        {SHAPES.map((s) => (
          <Key
            key={s}
            label={SHAPE_SPEC[s].label}
            tint={ink(hue).stamp}
            selected={s === shape}
            onPress={() => pickShape(s)}
          />
        ))}
      </View>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>{spec.hint}</Text>

      {spec.unit && (
        <View style={styles.detail}>
          <Text style={[styles.detailLabel, type.sansMedium, { color: colors.ink }]}>Unit</Text>
          <TextInput
            value={unit}
            onChangeText={setUnit}
            placeholder="kg"
            placeholderTextColor={alpha(colors.inkMuted, 0.5)}
            accessibilityLabel="Unit"
            autoCapitalize="none"
            style={[
              styles.unit,
              type.sans,
              { color: colors.ink, borderColor: alpha(colors.rule, 0.8) },
            ]}
          />
        </View>
      )}

      {spec.range && (
        <View style={styles.detail}>
          <Text style={[styles.detailLabel, type.sansMedium, { color: colors.ink }]}>Out of</Text>
          <View style={styles.outOf}>
            {[3, 5, 10].filter((n) => n <= SCALE_MAX).map((n) => (
              <Key
                key={n}
                label={String(n)}
                tint={ink(hue).stamp}
                selected={n === max}
                accessibilityLabel={`A scale of ${n}`}
                onPress={() => {
                  hapticTap();
                  setMax(n);
                }}
              />
            ))}
          </View>
        </View>
      )}

      <Eyebrow style={styles.head}>its colour</Eyebrow>
      <View style={styles.hues}>
        {CARD_HUES.map((h) => (
          <PressableScale
            key={h}
            scaleTo={0.88}
            accessibilityLabel={h}
            accessibilityState={{ selected: h === hue }}
            onPress={() => {
              hapticTap();
              setHue(h);
            }}
            style={[
              styles.swatch,
              {
                backgroundColor: ink(h).field,
                borderColor: h === hue ? ink(h).stamp : alpha(colors.rule, 0.6),
                borderWidth: h === hue ? 2 : 1,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <Key label="Cancel" onPress={onDone} />
        <StampButton color={ink(hue).solid} disabled={!ready} onPress={submit}>
          <Text style={[styles.stampText, type.sansSemiBold, { color: colors.paper }]}>
            Track it
          </Text>
        </StampButton>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16 },
  name: { marginTop: 4, fontSize: 24, letterSpacing: -0.5, paddingVertical: 2 },
  head: { marginTop: 18 },
  shapes: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { marginTop: 8, fontSize: 13 },
  detail: { marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  detailLabel: { fontSize: 14, flex: 1 },
  unit: { width: 84, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14 },
  outOf: { flexDirection: "row", gap: 8 },
  hues: { marginTop: 8, flexDirection: "row", gap: 10 },
  swatch: { height: 38, width: 38, borderRadius: 999 },
  actions: { marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  stampText: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
});
