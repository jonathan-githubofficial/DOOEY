import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { useShadow } from "@/features/style/store";
import type { Palette } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** A small cast-metal plaque, engraved — the gallery's call to action.
 * Top-lit sheen, a pressed emboss, and it sinks on tap. `palette` pins the
 * colours (the login wall is always lit); omitted, it follows the app theme. */
export function Plate({
  label,
  disabled,
  onPress,
  palette,
  style,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  palette?: Palette;
  style?: StyleProp<ViewStyle>;
}) {
  const themed = usePalette();
  const type = useType();
  const shadow = useShadow();
  const colors = palette ?? themed;
  return (
    <PressableScale
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.plate,
        {
          backgroundColor: colors.ink,
          shadowColor: colors.ink,
          shadowOpacity: 0.25 * shadow,
          elevation: Math.round(4 * shadow),
        },
        style,
        disabled && { opacity: 0.35 },
      ]}
    >
      {/* Physical light on metal, not palette: the sheen stays white in every theme. */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.18)", "transparent", "rgba(0,0,0,0.22)"]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[styles.plateText, type.sansSemiBold, { color: colors.paper }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  plate: {
    minWidth: 150,
    alignItems: "center",
    borderRadius: 5,
    paddingVertical: 13,
    paddingHorizontal: 34,
    overflow: "hidden",
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  plateText: {
    fontSize: 13,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
