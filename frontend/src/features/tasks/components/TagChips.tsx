import { X } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { hapticTap } from "@/lib/haptics";
import { appear, settle } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** A task's tags as coloured boxes, under whatever they belong to.
 *
 * Titles are stored plain — the `#` is a way of typing a tag, not a way of
 * keeping one. So nowhere in the app does a title read `Buy milk #errands`; it
 * reads `Buy milk`, with the tag sitting beneath it as its own object.
 *
 * Tapping a tag *goes to it* — the page of everything else carrying it — which
 * is the only thing a tag is for. Taking one off is a separate, smaller target
 * on the chip's own edge, because losing a tag by mis-tapping the thing you
 * meant to follow is the worse mistake of the two. */
export function TagChips({
  tags,
  onPress,
  onRemove,
  compact,
  style,
}: {
  tags: string[];
  /** Follow the tag. Without it the boxes are inert labels. */
  onPress?: (tag: string) => void;
  /** Adds the small ✕ on the chip's trailing edge. */
  onRemove?: (tag: string) => void;
  /** Row-sized: smaller, for a planner line. */
  compact?: boolean;
  style?: object;
}) {
  const colors = usePalette();
  const type = useType();
  if (tags.length === 0) return null;

  return (
    <View style={[styles.row, compact && styles.rowCompact, style]}>
      {tags.map((tag) => (
        <Animated.View
          key={tag}
          entering={onRemove ? appear() : FadeIn.duration(140)}
          layout={settle()}
          style={[
            compact ? styles.chipCompact : styles.chip,
            { backgroundColor: alpha(colors.sky, compact ? 0.13 : 0.16) },
          ]}
        >
          <PressableScale
            scaleTo={onPress ? 0.94 : 1}
            disabled={!onPress}
            accessibilityLabel={onPress ? `Tasks tagged ${tag}` : tag}
            onPress={() => {
              if (!onPress) return;
              hapticTap();
              onPress(tag);
            }}
            style={compact ? styles.bodyCompact : styles.body}
          >
            <Text
              style={[
                compact ? styles.textCompact : styles.text,
                type.sansMedium,
                { color: compact ? colors.inkMuted : colors.ink },
              ]}
            >
              {tag}
            </Text>
          </PressableScale>
          {!!onRemove && (
            <PressableScale
              scaleTo={0.8}
              accessibilityLabel={`Take the ${tag} tag off`}
              hitSlop={8}
              onPress={() => {
                hapticTap();
                onRemove(tag);
              }}
              style={styles.drop}
            >
              <X size={11} color={alpha(colors.ink, 0.45)} strokeWidth={2.5} />
            </PressableScale>
          )}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  rowCompact: { gap: 4 },
  chip: { flexDirection: "row", alignItems: "center", borderRadius: 8, paddingRight: 6 },
  chipCompact: { borderRadius: 6 },
  body: { paddingLeft: 9, paddingRight: 3, paddingVertical: 4 },
  bodyCompact: { paddingHorizontal: 6, paddingVertical: 1.5 },
  drop: { paddingLeft: 1, paddingRight: 2, paddingVertical: 4 },
  text: { fontSize: 12 },
  textCompact: { fontSize: 10 },
});
