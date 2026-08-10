import type { PropsWithChildren, ReactNode } from "react";
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
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useElevation, useType } from "@/stores/theme";

/** The skeuomorphic building block: a soft, rounded, grained, gently-shadowed
 * card. */
export function Panel({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const colors = usePalette();
  const radius = useCardRadius();
  const elevation = useElevation();
  return (
    <View
      style={[
        styles.panel,
        elevation,
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

/** The app's secondary action: a small paper key, cut from the same stock as a
 * Panel. Surface, grain, the user's rule, the user's soft light, and a press dip
 * — an object you push, which is what every other pressable thing here is.
 *
 * It replaces the hairline pill each page had been rolling for itself (`surface`
 * on a 999 lozenge with a faint border, twice on the gym page alone). That pill
 * was a browser chip: flat, weightless, wearing a radius the user's slider could
 * not reach, and the one thing on the page that looked bought rather than made.
 * A key is paper with a shadow under it. Same job, told in the app's own voice.
 *
 * The label is tracked uppercase, so where a Plate shouts a page's one big move
 * this murmurs a caption you can press. */
export function Key({
  icon,
  label,
  onPress,
  accessibilityLabel,
  tint,
  selected,
  style,
}: {
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  /** When the label alone undersells where this goes. */
  accessibilityLabel?: string;
  /** The hue a selected key wears. Ignored while unselected: a key at rest is
   * paper, and a row of them would otherwise be a row of shouting. */
  tint?: string;
  /** One of a set, and this is the one. A key can say "you are here" as well as
   * "press me", which is what kept every page from rolling its own tinted pill
   * beside the plain ones. */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = usePalette();
  const type = useType();
  const radius = useCardRadius();
  const elevation = useElevation();
  const lit = selected && tint;
  // The user's radius, but a key is 34pt tall: past half its height the corners
  // stop being corners and it turns back into the lozenge this replaced. So it
  // follows their slider until the shape would stop being a key.
  const keyRadius = Math.min(radius, KEY_H / 2 - 5);
  return (
    <PressableScale
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={[
        styles.key,
        elevation,
        {
          borderRadius: keyRadius,
          backgroundColor: lit ? alpha(tint, 0.14) : colors.surface,
          borderColor: lit ? alpha(tint, 0.5) : alpha(colors.rule, 0.7),
        },
        style,
      ]}
    >
      {/* Inside the 1pt border, like the Panel's. */}
      <Grain radius={keyRadius - 1} />
      {icon}
      <Text
        numberOfLines={1}
        style={[styles.keyText, type.sansSemiBold, { color: lit ? tint : colors.ink }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

/** Uppercase, tracked micro-label used inside cards. */
export function Eyebrow({
  style,
  numberOfLines,
  children,
}: PropsWithChildren<{ style?: StyleProp<TextStyle>; numberOfLines?: number }>) {
  const colors = usePalette();
  const type = useType();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles.eyebrow, type.sansMedium, { color: colors.inkMuted }, style]}
    >
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
  color,
  disabled,
  style,
  children,
}: PropsWithChildren<{
  onPress: () => void;
  accent?: boolean;
  /** An explicit stamp colour, for callers that already own a hue — beats
   * `accent`, which is the shorthand for zest. */
  color?: string;
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
        // web gets the legacy .stamp-btn drop-shadow filter INSTEAD of shadow*
        // props, which RNW would turn into a rectangular box-shadow behind
        // the teeth.
        Platform.OS === "web"
          ? ({
              filter: `drop-shadow(0 1.5px 1.5px ${alpha(colors.ink, 0.2 * shadow)})`,
            } as unknown as ViewStyle)
          : [
              styles.stampShadow,
              {
                shadowColor: colors.ink,
                shadowOpacity: 0.2 * shadow,
                elevation: Math.round(2 * shadow),
              },
            ],
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <StampEdge color={color ?? (accent ? colors.zest : colors.surface)} />
      {children}
    </PressableScale>
  );
}

/** A key's height: a comfortable tap target that still reads as furniture beside
 * a 30pt space title rather than as a button bar. */
const KEY_H = 34;

const styles = StyleSheet.create({
  key: {
    height: KEY_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  keyText: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  panel: {
    borderWidth: 1,
    // The standard inset for card content — callers override with their own
    // `padding` (or `padding: 0` for a full-bleed card). Baked in here so no
    // panel ends up with content flush against its edge.
    padding: 20,
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
  },
  stampShadow: {
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1.5 },
  },
});
