import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** − n + : a number set by tapping rather than typing.
 *
 * There were two of these, in `preferences` and the routine editor, differing
 * only in whether they carried a label and whether they used the app's press
 * primitive (one did not, which the design checker flags). This is the one that
 * did it properly, with the label made optional.
 *
 * `width` widens the readout for values that need the room — "1m 30s" rather
 * than "12". */
export function Stepper({
  label,
  name,
  value,
  display,
  min,
  max,
  step = 1,
  width,
  onChange,
}: {
  /** Tracked-caps eyebrow above the control. Omit it where the surrounding
   * row already names the value. */
  label?: string;
  /** What the value *is*, for screen readers. Defaults to `label`; pass it
   * explicitly when the label is hidden but the button still has to say
   * "Fewer rest" rather than "Fewer value". */
  name?: string;
  value: number;
  display?: string;
  min: number;
  max?: number;
  step?: number;
  width?: number;
  onChange: (v: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const noun = name ?? label ?? "value";

  const nudge = (by: number) => {
    hapticTap();
    const next = value + by;
    onChange(Math.min(max ?? Infinity, Math.max(min, next)));
  };

  return (
    <View style={styles.stepper}>
      {!!label && (
        <Text style={[styles.label, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
      )}
      <View style={[styles.well, { backgroundColor: alpha(colors.ink, 0.05) }]}>
        <PressableScale
          scaleTo={0.8}
          accessibilityLabel={`Fewer ${noun}`}
          onPress={() => nudge(-step)}
          style={styles.btn}
        >
          <Text style={[styles.sign, type.sansMedium, { color: colors.inkMuted }]}>−</Text>
        </PressableScale>
        <Text
          style={[styles.value, type.sansSemiBold, { color: colors.ink }, !!width && { minWidth: width }]}
        >
          {display ?? value}
        </Text>
        <PressableScale
          scaleTo={0.8}
          accessibilityLabel={`More ${noun}`}
          onPress={() => nudge(step)}
          style={styles.btn}
        >
          <Text style={[styles.sign, type.sansMedium, { color: colors.inkMuted }]}>+</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { gap: 5 },
  label: { fontSize: 9.5, letterSpacing: 1.6, textTransform: "uppercase" },
  well: { flexDirection: "row", alignItems: "center", borderRadius: 10 },
  btn: { height: 34, width: 32, alignItems: "center", justifyContent: "center" },
  sign: { fontSize: 16 },
  value: { minWidth: 28, textAlign: "center", fontSize: 14.5, fontVariant: ["tabular-nums"] },
});
