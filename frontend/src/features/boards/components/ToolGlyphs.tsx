import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { fontStyle } from "@/features/style/tokens";
import { alpha, relight, type Palette } from "@/lib/theme";

/** The shelf's tools are little physical objects, not icons: a type slug, a
 * sticky note, a paperclip, a peeled sticker, a polaroid, a rubber stamp, a
 * corral, a pen. You reach for the thing you want and put it on the paper.
 *
 * The web drew these in fixed real-world colours on the argument that a sticky
 * note is yellow even in dark mode. Here they are cut from the user's own
 * palette instead: the honey token *is* their yellow, and a tool shelf that
 * ignored the palette would be the one corner of the app they could not
 * repaint. Each object keeps its shape, which is what makes it readable. */

export type ToolGlyphProps = { colors: Palette; size?: number };

export function TypeSlugGlyph({ colors, size = 26 }: ToolGlyphProps) {
  return (
    <View
      style={[
        styles.slug,
        {
          height: size,
          width: size,
          backgroundColor: relight(colors.paper, 30, 94),
          borderColor: alpha(colors.ink, 0.12),
        },
      ]}
    >
      <Text style={[fontStyle("fraunces", "900"), { fontSize: size * 0.54, color: colors.ink }]}>
        Aa
      </Text>
    </View>
  );
}

export function StickyGlyph({ colors, size = 24 }: ToolGlyphProps) {
  const fold = size * 0.34;
  return (
    <View style={[styles.sticky, { height: size, width: size, backgroundColor: colors.honey }]}>
      <Svg width={fold} height={fold} style={styles.stickyFold}>
        <Path d={`M0 ${fold} L${fold} 0 L0 0 Z`} fill={relight(colors.honey, 45, 62)} />
      </Svg>
    </View>
  );
}

export function PaperclipGlyph({ colors, size = 26 }: ToolGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={styles.clip}>
      <Path
        d="M8.5 6.5v9a3.5 3.5 0 0 0 7 0v-10a2.25 2.25 0 0 0-4.5 0v9a1.25 1.25 0 0 0 2.5 0v-8"
        fill="none"
        stroke={relight(colors.sky, 14, 62)}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function StickerGlyph({ colors, size = 26 }: ToolGlyphProps) {
  return (
    <View
      style={[
        styles.sticker,
        { height: size, width: size, backgroundColor: relight(colors.paper, 20, 98) },
      ]}
    >
      <Text style={{ fontSize: size * 0.52 }}>⭐</Text>
    </View>
  );
}

export function PolaroidGlyph({ colors, size = 24 }: ToolGlyphProps) {
  return (
    <View
      style={[
        styles.polaroid,
        {
          width: size,
          backgroundColor: relight(colors.paper, 18, 98),
          borderColor: alpha(colors.ink, 0.12),
        },
      ]}
    >
      <View style={[styles.polaroidWindow, { backgroundColor: colors.sky }]}>
        <View style={[styles.polaroidSun, { backgroundColor: colors.honey }]} />
      </View>
    </View>
  );
}

export function StampGlyph({ colors, size = 28 }: ToolGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={10.2} y={3.5} width={3.6} height={5.5} rx={1.6} fill={relight(colors.clay, 32, 62)} />
      <Path
        d="M8.2 13.5c0-2 1.4-2.6 3.8-2.6s3.8.6 3.8 2.6l.7 3H7.5z"
        fill={relight(colors.clay, 30, 52)}
      />
      <Rect x={5.5} y={16.5} width={13} height={4} rx={1.2} fill={relight(colors.clay, 28, 40)} />
    </Svg>
  );
}

export function SectionGlyph({ colors, size = 26 }: ToolGlyphProps) {
  return (
    <View style={[styles.section, { width: size, height: size * 0.76, borderColor: colors.sky }]}>
      <View style={[styles.sectionTab, { backgroundColor: alpha(colors.sky, 0.7) }]} />
    </View>
  );
}

export function PenGlyph({ colors, size = 30 }: ToolGlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={10} y={2.5} width={4} height={3} rx={1} fill={colors.ink} />
      <Path d="M10 5.5h4V16l-2 5.5L10 16z" fill={colors.zest} />
      <Path d="M10.6 16.4h2.8L12 20.3z" fill={colors.ink} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  slug: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
    borderWidth: 1,
    transform: [{ rotate: "-2deg" }],
  },
  sticky: { transform: [{ rotate: "3deg" }] },
  stickyFold: { position: "absolute", right: 0, bottom: 0 },
  clip: { transform: [{ rotate: "12deg" }] },
  sticker: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    transform: [{ rotate: "-6deg" }],
  },
  polaroid: {
    padding: 2,
    paddingBottom: 5,
    borderWidth: 1,
    transform: [{ rotate: "-3deg" }],
  },
  polaroidWindow: { height: 15, borderRadius: 1, overflow: "hidden" },
  polaroidSun: { position: "absolute", left: 3, top: 3, height: 5, width: 5, borderRadius: 999 },
  section: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 6,
  },
  sectionTab: {
    position: "absolute",
    left: 4,
    top: 3,
    height: 3,
    width: 10,
    borderRadius: 999,
  },
});
