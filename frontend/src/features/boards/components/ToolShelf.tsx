import { Eraser, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { useCardRadius } from "@/features/style/store";
import { INK_COLORS, type InkColor } from "@/lib/doodle";
import { dur, ease, timing } from "@/lib/motion";
import { alpha, type Palette } from "@/lib/theme";
import { useType } from "@/stores/theme";
import { DoodleTray } from "./DoodleTray";
import {
  PaperclipGlyph,
  PenGlyph,
  PolaroidGlyph,
  SectionGlyph,
  StampGlyph,
  StickerGlyph,
  StickyGlyph,
  TypeSlugGlyph,
  type ToolGlyphProps,
} from "./ToolGlyphs";
import { STICKERS, type PackDoodle } from "../types";

/** What a tool makes. The photo tool has to ask the OS first, so it carries no
 * payload of its own. */
export type PlaceSpec =
  | { kind: "note" | "text" | "link" | "section" }
  | { kind: "sticker"; emoji: string }
  | { kind: "doodle"; strokes: PackDoodle["strokes"]; aspect: number }
  | { kind: "photo" };

type ToolId = "text" | "note" | "link" | "sticker" | "photo" | "doodle" | "section";

const TOOLS: {
  id: ToolId;
  label: string;
  Glyph: (p: ToolGlyphProps) => React.JSX.Element;
  /** Tools that need a choice before they can make anything. */
  opens?: "stickers" | "doodles" | "photo";
}[] = [
  { id: "text", label: "Text", Glyph: TypeSlugGlyph },
  { id: "note", label: "Sticky note", Glyph: StickyGlyph },
  { id: "link", label: "Link", Glyph: PaperclipGlyph },
  { id: "sticker", label: "Sticker", Glyph: StickerGlyph, opens: "stickers" },
  { id: "photo", label: "Photo", Glyph: PolaroidGlyph, opens: "photo" },
  { id: "doodle", label: "Doodle packs", Glyph: StampGlyph, opens: "doodles" },
  { id: "section", label: "Section", Glyph: SectionGlyph },
];

/** The tool shelf.
 *
 * Two ways to use every tool, because the right one depends on what you are
 * doing. **Tap** it and the thing lands in the middle of what you are looking
 * at, already selected and, if it takes words, already asking for them.
 * **Drag** it out and it lands exactly where you let go. Neither one opens a
 * dialog to ask what you meant: the object is on the paper first and you
 * change your mind on the canvas, which is where you can see it.
 *
 * Tools that genuinely need a choice first — which emoji, which doodle, which
 * photo — open a palette attached to the shelf rather than a screen of their
 * own, and every swatch in that palette is itself tappable and draggable. */
export function ToolShelf({
  colors,
  bottom,
  drawing,
  ink,
  erasing,
  onInk,
  onDraw,
  onToggleErase,
  onPlace,
}: {
  colors: Palette;
  bottom: number;
  drawing: boolean;
  ink: InkColor;
  erasing: boolean;
  onInk: (c: InkColor) => void;
  /** Explicit rather than a toggle: every other tool needs to be able to put
   * the pen down, and a toggle can only flip whatever it finds. */
  onDraw: (on: boolean) => void;
  onToggleErase: () => void;
  /** `at` is a window coordinate when the tool was dragged out, absent when it
   * was tapped (which drops into the middle of the view). */
  onPlace: (spec: PlaceSpec, at?: { x: number; y: number }) => void;
}) {
  const type = useType();
  const radius = useCardRadius();
  const [tray, setTray] = useState<"stickers" | "doodles" | null>(null);
  const [ghost, setGhost] = useState<React.ReactNode>(null);

  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const gOn = useSharedValue(0);
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: gOn.value,
    transform: [{ translateX: gx.value - 22 }, { translateY: gy.value - 26 }],
  }));

  /** Reaching for anything else puts the pen down. Without this the ink row
   * stays up and, worse, the drawing sheet stays over the board, so the piece
   * you just placed cannot be touched. */
  const leavePen = () => {
    setTray(null);
    onDraw(false);
  };

  /** Tap places at the centre; a drag places under the finger. Both end in the
   * same call, so a tool only ever has to describe what it makes. */
  const draggable = (spec: PlaceSpec, preview: React.ReactNode) => {
    const show = () => setGhost(preview);
    const hide = () => setGhost(null);
    const pan = Gesture.Pan()
      .onStart((e) => {
        runOnJS(leavePen)();
        gx.value = e.absoluteX;
        gy.value = e.absoluteY;
        gOn.value = withTiming(1, timing(dur.instant, ease.out));
        runOnJS(show)();
      })
      .onUpdate((e) => {
        gx.value = e.absoluteX;
        gy.value = e.absoluteY;
      })
      .onEnd((e) => {
        runOnJS(onPlace)(spec, { x: e.absoluteX, y: e.absoluteY });
      })
      .onFinalize(() => {
        gOn.value = withTiming(0, timing(dur.instant, ease.in));
        runOnJS(hide)();
      });
    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd(() => {
        runOnJS(leavePen)();
        runOnJS(onPlace)(spec);
      });
    return Gesture.Exclusive(pan, tap);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.host]} pointerEvents="box-none">
      {/* The thing being carried out of the shelf. */}
      <Animated.View style={[styles.ghost, ghostStyle]} pointerEvents="none">
        {ghost}
      </Animated.View>

      <View style={[styles.stack, { bottom }]} pointerEvents="box-none">
        {tray === "stickers" && (
          <ToolPalette label="stickers" colors={colors} onClose={() => setTray(null)}>
            <View style={styles.stickerGrid}>
              {STICKERS.map((emoji) => (
                <GestureDetector
                  key={emoji}
                  gesture={draggable(
                    { kind: "sticker", emoji },
                    <Text style={styles.ghostEmoji}>{emoji}</Text>,
                  )}
                >
                  <View style={styles.stickerCell}>
                    <Text style={styles.stickerEmoji}>{emoji}</Text>
                  </View>
                </GestureDetector>
              ))}
            </View>
          </ToolPalette>
        )}

        {tray === "doodles" && (
          <ToolPalette label="doodle packs" colors={colors} scroll onClose={() => setTray(null)}>
            <DoodleTray
              colors={colors}
              onDoodleGesture={(d, preview) =>
                draggable({ kind: "doodle", strokes: d.strokes, aspect: d.aspect }, preview)
              }
              onPlaceDoodle={(d) =>
                onPlace({ kind: "doodle", strokes: d.strokes, aspect: d.aspect })
              }
            />
          </ToolPalette>
        )}

        <View
          style={[
            styles.shelf,
            {
              borderRadius: radius,
              backgroundColor: alpha(colors.surface, 0.96),
              borderColor: alpha(colors.rule, 0.7),
            },
          ]}
        >
          <Grain radius={radius - 1} />
          {TOOLS.map((tool) => {
            const opens = tool.opens;
            const glyph = <tool.Glyph colors={colors} />;
            const slot = (
              <View style={styles.slot}>
                {glyph}
                {tray === opens && <View style={[styles.pip, { backgroundColor: colors.zest }]} />}
              </View>
            );
            if (opens === "photo") {
              return (
                <PressableScale
                  key={tool.id}
                  scaleTo={0.88}
                  accessibilityLabel={tool.label}
                  onPress={() => {
                    leavePen();
                    onPlace({ kind: "photo" });
                  }}
                >
                  {slot}
                </PressableScale>
              );
            }
            if (opens) {
              return (
                <Pressable
                  key={tool.id}
                  accessibilityLabel={tool.label}
                  onPress={() => {
                    onDraw(false);
                    setTray((t) => (t === opens ? null : opens));
                  }}
                >
                  {slot}
                </Pressable>
              );
            }
            return (
              <GestureDetector
                key={tool.id}
                gesture={draggable({ kind: tool.id as "note" | "text" | "link" | "section" }, glyph)}
              >
                {slot}
              </GestureDetector>
            );
          })}

          <View style={[styles.divider, { backgroundColor: alpha(colors.rule, 0.8) }]} />

          <Pressable
            accessibilityLabel={drawing ? "Stop drawing" : "Draw"}
            onPress={() => {
              setTray(null);
              onDraw(!drawing);
            }}
          >
            <View style={styles.slot}>
              <PenGlyph colors={colors} />
              {drawing && <View style={[styles.pip, { backgroundColor: colors.zest }]} />}
            </View>
          </Pressable>
        </View>

        {/* Draw mode brings its own row: the inks, and an eraser, because undo
            cannot reach a stroke you laid down five strokes ago. */}
        {drawing && (
          <View
            style={[
              styles.inks,
              { backgroundColor: alpha(colors.surface, 0.96), borderColor: alpha(colors.rule, 0.7) },
            ]}
          >
            {INK_COLORS.map((c) => (
              <PressableScale
                key={c}
                scaleTo={0.82}
                accessibilityLabel={`${c} ink`}
                onPress={() => onInk(c)}
                style={[
                  styles.inkDot,
                  { backgroundColor: colors[c as keyof Palette] },
                  !erasing && ink === c && { borderWidth: 2, borderColor: alpha(colors.ink, 0.4) },
                ]}
              />
            ))}
            <PressableScale
              scaleTo={0.86}
              accessibilityLabel="Eraser"
              onPress={onToggleErase}
              style={[styles.eraser, erasing && { backgroundColor: alpha(colors.zest, 0.18) }]}
            >
              <Eraser size={15} color={erasing ? colors.zest : colors.inkMuted} />
            </PressableScale>
            <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
              {erasing ? "rub out" : "two fingers to move"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** A palette attached to the shelf: the swatches a tool needs before it can
 * make anything. Scrolls only when its contents can outgrow it, so a short
 * grid never steals the drag that is carrying a swatch onto the board. */
function ToolPalette({
  label,
  colors,
  scroll,
  onClose,
  children,
}: {
  label: string;
  colors: Palette;
  scroll?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const type = useType();
  const radius = useCardRadius();
  return (
    <View
      style={[
        styles.palette,
        { borderRadius: radius, backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
      ]}
    >
      <Grain radius={radius - 1} />
      <View style={styles.paletteHead}>
        <Text style={[styles.paletteLabel, type.sansMedium, { color: colors.inkMuted }]}>
          {label}
        </Text>
        <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose}>
          <X size={14} color={colors.inkMuted} />
        </Pressable>
      </View>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.paletteBody}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.paletteBody}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: "flex-end" },
  stack: { position: "absolute", left: 0, right: 0, alignItems: "center", gap: 8 },
  ghost: { position: "absolute", left: 0, top: 0 },
  ghostEmoji: { fontSize: 34 },
  shelf: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  slot: {
    height: 46,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  pip: {
    position: "absolute",
    bottom: 4,
    height: 3,
    width: 14,
    borderRadius: 999,
  },
  divider: { marginHorizontal: 4, height: 26, width: 1 },
  inks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inkDot: { height: 18, width: 18, borderRadius: 999 },
  eraser: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  hint: { fontSize: 10 },
  palette: {
    maxWidth: 320,
    maxHeight: 260,
    borderWidth: 1,
    padding: 10,
  },
  paletteHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paletteLabel: { fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
  paletteBody: { marginTop: 8 },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  stickerCell: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerEmoji: { fontSize: 26 },
});
