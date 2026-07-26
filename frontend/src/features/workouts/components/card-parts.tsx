import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DoodleSvg } from "@/components/DoodleSvg";
import { DotsButton } from "@/components/dots-button";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import type { Menu } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { useCardInk } from "../hues";
import type { CardHue } from "../types";

/** The card's drawing, blown up and bled off the bottom-right corner — big
 * enough to be the card's face, pale enough that the title still wins. */
export function Watermark({
  strokes,
  tint,
  size,
}: {
  strokes: Stroke[];
  tint: string;
  size: number;
}) {
  if (strokes.length === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.mark,
        { width: size, height: size, right: -size * 0.12, bottom: -size * 0.1 },
      ]}
    >
      <DoodleSvg strokes={strokes} strokeWidth={2.6} tint={tint} opacity={0.5} />
    </View>
  );
}

/** Every card on the board: a colour field, its drawing behind, a hand-pinned
 * lean. Callers stack their own content in the padded area on top. */
export function CardShell({
  hue,
  emblem,
  lean,
  markSize = 110,
  onPress,
  accessibilityLabel,
  children,
}: PropsWithChildren<{
  hue: CardHue;
  emblem: Stroke[];
  lean: string;
  markSize?: number;
  onPress: () => void;
  accessibilityLabel: string;
}>) {
  const ink = useCardInk()(hue);
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{ transform: [{ rotate: lean }] }}
    >
      <Panel style={[styles.card, { backgroundColor: ink.field }]}>
        <Watermark strokes={emblem} tint={ink.mark} size={markSize} />
        {children}
      </Panel>
    </PressableScale>
  );
}

/** Title, one line of meta, and the focus tag — the same three lines on every
 * card, so a wall of them scans as one list. */
export function CardFace({
  title,
  meta,
  tag,
  hue,
  air,
  titleSize = 19,
}: {
  title: string;
  meta: string;
  tag: string | null;
  hue: CardHue;
  air: number;
  titleSize?: number;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk()(hue);
  return (
    <>
      <View style={{ height: air }} />
      <Text
        numberOfLines={2}
        style={[type.display, styles.title, { fontSize: titleSize, color: colors.ink }]}
      >
        {title}
      </Text>
      <Text numberOfLines={1} style={[type.sans, styles.meta, { color: colors.inkMuted }]}>
        {meta}
      </Text>
      {tag && (
        <View style={styles.tagRow}>
          <View style={[styles.tag, { borderColor: ink.stamp }]}>
            <Text style={[type.sansSemiBold, styles.tagText, { color: ink.stamp }]}>{tag}</Text>
          </View>
        </View>
      )}
    </>
  );
}

/** The ⋯ affordance, in the one corner the watermark never reaches. */
export function CardMenu({ label, menu }: { label: string; menu: () => Menu }) {
  const colors = usePalette();
  return (
    <DotsButton
      label={label}
      menu={menu}
      style={[styles.menu, { backgroundColor: alpha(colors.surface, 0.7) }]}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, overflow: "hidden" },
  mark: { position: "absolute" },
  title: { letterSpacing: -0.4 },
  meta: { marginTop: 3, fontSize: 12 },
  tagRow: { flexDirection: "row", marginTop: 12 },
  tag: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    opacity: 0.9,
    transform: [{ rotate: "-2deg" }],
  },
  tagText: { fontSize: 9, letterSpacing: 1.8, textTransform: "uppercase" },
  menu: { position: "absolute", top: 6, right: 6, zIndex: 2 },
});
