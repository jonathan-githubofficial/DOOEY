import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
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
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  palette?: Palette;
}) {
  const themed = usePalette();
  const type = useType();
  const colors = palette ?? themed;
  return (
    <PressableScale
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.plate, { backgroundColor: colors.ink }, disabled && { opacity: 0.35 }]}
    >
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
    shadowColor: "#282018",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  plateText: {
    fontSize: 13,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
});
