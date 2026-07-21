import type { PropsWithChildren } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { StampEdge } from "@/components/stamp-edge";
import { useCardRadius, useShadow } from "@/features/style/store";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The skeuomorphic building block: a soft, rounded, grained, gently-shadowed
 * card. */
export function Panel({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = usePalette();
  const radius = useCardRadius();
  const shadow = useShadow();
  return (
    <View
      style={[
        styles.panel,
        {
          borderRadius: radius,
          backgroundColor: colors.surface,
          borderColor: alpha(colors.rule, 0.7),
          shadowOpacity: 0.08 * shadow,
          elevation: Math.round(2 * shadow),
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

/** Uppercase, tracked micro-label used inside cards. */
export function Eyebrow({ style, children }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  const colors = usePalette();
  const type = useType();
  return (
    <Text style={[styles.eyebrow, type.sansMedium, { color: colors.inkMuted }, style]}>
      {children}
    </Text>
  );
}

/** A rubber-stamp badge — rotated, tracked, semi-inked. Colour via `color`. */
export function Stamp({
  children,
  color,
  rotate = -3,
  style,
}: PropsWithChildren<{ color: string; rotate?: number; style?: StyleProp<ViewStyle> }>) {
  const type = useType();
  return (
    <View
      style={[
        styles.stamp,
        { borderColor: color, transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      <Text style={[styles.stampText, type.sansSemiBold, { color }]}>{children}</Text>
    </View>
  );
}

/** A button shaped like a postage stamp — perforated edges punched with an
 * SVG mask, exactly like the web's CSS-mask stamp. Spring press. */
export function StampButton({
  onPress,
  accent,
  disabled,
  style,
  children,
}: PropsWithChildren<{
  onPress: () => void;
  accent?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const colors = usePalette();
  const shadow = useShadow();
  return (
    <PressableScale
      scaleTo={0.95}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.stampBtn,
        // iOS shadows trace the layer's alpha, so the soft shadow follows the
        // perforated silhouette; Android's elevation stays rectangular; the
        // web gets the legacy .stamp-btn drop-shadow filter.
        { shadowOpacity: 0.2 * shadow, elevation: Math.round(2 * shadow) },
        Platform.OS === "web" &&
          ({ filter: "drop-shadow(0 1.5px 1.5px rgb(40 32 24 / 0.2))" } as unknown as ViewStyle),
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <StampEdge color={accent ? colors.zest : colors.surface} />
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    // Soft two-layer web shadow approximated with one gentle native shadow.
    shadowColor: "#282018",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  stamp: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    opacity: 0.9,
  },
  stampText: {
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  stampBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: "#282018",
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1.5 },
  },
});
