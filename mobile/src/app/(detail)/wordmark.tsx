import { ChevronLeft, Pencil, Plus, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleEditor } from "@/components/DoodleEditor";
import { DoodleFlipbook } from "@/components/DoodleFlipbook";
import { DoodleSvg } from "@/components/DoodleSvg";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { useStyleStore } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const MAX_FRAMES = 4;

// The drawing pad and the login page must agree on geometry, or the doodle
// lands somewhere else than it was drawn: wordmark fontSize = ratio × square.
const WORDMARK_RATIO = 0.2;
const PAD_SIZE = 240; // DoodleEditor's card is 264 with 12 padding
const PREVIEW_SIZE = 200;

const SPEEDS = [
  { label: "slow", ms: 800 },
  { label: "steady", ms: 550 },
  { label: "quick", ms: 320 },
  { label: "zippy", ms: 180 },
] as const;

/** The wordmark studio: doodle an animation on and around the DOOEY wordmark
 * itself — the pad shows it, you draw over it, and the login page plays your
 * frames on a loop at the speed you pick. */
export default function Wordmark() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const frames = useStyleStore((s) => s.logoDoodle);
  const setLogoDoodle = useStyleStore((s) => s.setLogoDoodle);
  const interval = useStyleStore((s) => s.logoInterval);
  const setLogoInterval = useStyleStore((s) => s.setLogoInterval);
  // Editing an existing frame by index; frames.length means "a new frame".
  const [editing, setEditing] = useState<number | null>(frames.length === 0 ? 0 : null);

  const saveFrame = (index: number, strokes: Stroke[]) => {
    const next = [...frames];
    next[index] = strokes;
    setLogoDoodle(next);
    setEditing(null);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
      >
        <View style={styles.headRow}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Back to Account"
            onPress={() => router.back()}
            style={styles.back}
          >
            <ChevronLeft size={22} color={colors.inkMuted} />
          </PressableScale>
          <Masthead title="Wordmark" />
        </View>

        {/* The door, previewed: exactly what the login page will show — the
            wordmark with your doodle playing over and around it. */}
        <Panel style={styles.preview}>
          <Eyebrow>at the door</Eyebrow>
          <View style={styles.previewStage}>
            <WordmarkText size={PREVIEW_SIZE} />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <DoodleFlipbook frames={frames} interval={interval} />
            </View>
          </View>
          <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
            Draw on and around the wordmark — each new pad ghosts the last frame so the motion
            lines up. Two or more frames and it comes alive on the login page.
          </Text>

          {frames.length > 1 && (
            <View style={styles.speedRow}>
              {SPEEDS.map((s) => {
                const active = interval === s.ms;
                return (
                  <PressableScale
                    key={s.ms}
                    scaleTo={0.92}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.label} frame rate`}
                    onPress={() => setLogoInterval(s.ms)}
                    style={[
                      styles.speedChip,
                      {
                        backgroundColor: active ? alpha(colors.zest, 0.15) : colors.paper,
                        borderColor: active ? colors.zest : alpha(colors.rule, 0.8),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.speedLabel,
                        type.sansMedium,
                        { color: active ? colors.ink : colors.inkMuted },
                      ]}
                    >
                      {s.label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </Panel>

        <Panel style={styles.framesPanel}>
          <Eyebrow>frames</Eyebrow>
          <View style={styles.grid}>
            {frames.map((strokes, i) => (
              <View key={i} style={styles.cell}>
                <PressableScale
                  scaleTo={0.95}
                  accessibilityLabel={`Edit frame ${i + 1}`}
                  onPress={() => setEditing((e) => (e === i ? null : i))}
                  style={[
                    styles.tile,
                    {
                      backgroundColor: colors.paper,
                      borderColor: editing === i ? colors.zest : alpha(colors.rule, 0.7),
                    },
                  ]}
                >
                  <Grain radius={15} />
                  <View style={styles.tileArt}>
                    <DoodleSvg strokes={strokes} />
                  </View>
                  <Pressable
                    accessibilityLabel={`Remove frame ${i + 1}`}
                    hitSlop={6}
                    onPress={() => {
                      setLogoDoodle(frames.filter((_, j) => j !== i));
                      setEditing(null);
                    }}
                    style={[styles.tileRemove, { backgroundColor: alpha(colors.paper, 0.9) }]}
                  >
                    <X size={10} color={colors.ink} />
                  </Pressable>
                </PressableScale>
                <Text style={[styles.tileLabel, type.sansMedium, { color: colors.inkMuted }]}>
                  frame {i + 1}
                </Text>
              </View>
            ))}
            {frames.length < MAX_FRAMES && (
              <View style={styles.cell}>
                <PressableScale
                  scaleTo={0.95}
                  accessibilityLabel="Add a frame"
                  onPress={() => setEditing(frames.length)}
                  style={[
                    styles.tile,
                    styles.tileAdd,
                    { borderColor: editing === frames.length ? colors.zest : alpha(colors.rule, 0.9) },
                  ]}
                >
                  {frames.length === 0 ? (
                    <Pencil size={16} color={alpha(colors.inkMuted, 0.5)} />
                  ) : (
                    <Plus size={16} color={alpha(colors.inkMuted, 0.5)} />
                  )}
                </PressableScale>
                <Text style={[styles.tileLabel, type.sansMedium, { color: colors.inkMuted }]}>
                  {frames.length === 0 ? "first frame" : "add frame"}
                </Text>
              </View>
            )}
          </View>

          {editing != null && (
            <Animated.View key={editing} entering={FadeIn.duration(160)} style={styles.editor}>
              <DoodleEditor
                heading={`frame ${editing + 1}`}
                initial={frames[editing] ?? []}
                underlay={editing > 0 ? frames[editing - 1] : undefined}
                stage={<WordmarkText size={PAD_SIZE} />}
                onClose={() => setEditing(null)}
                onSave={(strokes) => saveFrame(editing, strokes)}
              />
            </Animated.View>
          )}
        </Panel>
      </ScrollView>
    </View>
  );
}

/** The wordmark as a stage fixture, sized to the square it sits in so the
 * editor pad, the preview and the login page all line up. */
function WordmarkText({ size }: { size: number }) {
  const colors = usePalette();
  return (
    <Text
      style={[fontStyle("fraunces", "900"), { fontSize: size * WORDMARK_RATIO, letterSpacing: 1, color: colors.ink }]}
    >
      DOOEY<Text style={{ color: colors.zest }}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  back: {
    height: 40,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: {
    marginTop: 16,
    alignItems: "center",
  },
  previewStage: {
    height: PREVIEW_SIZE,
    width: PREVIEW_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  speedRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  speedChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  speedLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  framesPanel: {
    marginTop: 14,
  },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  cell: {
    alignItems: "center",
    gap: 5,
  },
  tile: {
    height: 72,
    width: 72,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  tileArt: {
    flex: 1,
    margin: 6,
  },
  tileAdd: {
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  tileRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    height: 16,
    width: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  editor: {
    marginTop: 14,
    alignItems: "center",
  },
});
