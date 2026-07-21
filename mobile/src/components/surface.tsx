import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { Grain } from "@/components/grain";
import { useCardRadius } from "@/features/style/store";
import { alpha, fonts } from "@/lib/theme";
import { usePalette } from "@/stores/theme";

/** A soft paper card — the RN counterpart of the web app's Panel. Wears the
 * paper grain and the Style page's corner radius. */
export function Panel({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = usePalette();
  const radius = useCardRadius();
  return (
    <View
      style={[
        styles.panel,
        {
          borderRadius: radius,
          backgroundColor: colors.surface,
          borderColor: alpha(colors.rule, 0.7),
        },
        style,
      ]}
    >
      {/* The grain clips itself to the card's corners — an overflow:hidden on
          the panel would clip the iOS shadow instead. */}
      <Grain radius={radius - 1} />
      {children}
    </View>
  );
}

/** Tiny tracked-uppercase section label. */
export function Eyebrow({ style, children }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  const colors = usePalette();
  return (
    <Text style={[styles.eyebrow, { color: colors.inkMuted }, style]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    // Soft two-layer web shadow approximated with one gentle native shadow.
    shadowColor: "#282018",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
});
