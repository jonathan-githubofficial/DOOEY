import { Plus } from "lucide-react-native";
import { ScrollView, StyleSheet, Text } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { hapticTap } from "@/lib/haptics";
import { dur } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useAllTags } from "../api";
import { isReserved, RESERVED_TAGS, suggestTags } from "../tags";

/** The list that opens under the title the moment you type `#`.
 *
 * Every tag you already use, with the app's own three at the front, narrowing
 * as you type. The last chip is always the one that makes a new tag out of what
 * you've typed — so a tag is never something you have to go and set up first,
 * and the ones you have are never something you have to remember the spelling
 * of. That is the whole tag system: no registry to curate, no rename screen.
 *
 * Reserved tags are marked, because they aren't just a word you chose — a space
 * in the app answers to them. */
export function TagPicker({
  query,
  taken,
  onPick,
}: {
  /** What has been typed after the `#`, possibly empty. */
  query: string;
  /** Tags the task already carries — they drop out of the list. */
  taken: string[];
  onPick: (tag: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const { data: known = [] } = useAllTags();

  const matches = suggestTags(query, known, taken);
  // Only when it would actually make something new — offering "create #gym"
  // next to the existing `gym` chip is two buttons doing the same thing.
  const canCreate = query.length > 0 && !matches.includes(query);
  if (matches.length === 0 && !canCreate) return null;

  const pick = (tag: string) => {
    hapticTap();
    onPick(tag);
  };

  return (
    <Animated.View entering={FadeIn.duration(dur.instant)} style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.row}
      >
        {matches.map((tag) => (
          <PressableScale
            key={tag}
            scaleTo={0.93}
            accessibilityLabel={`Tag as ${tag}`}
            onPress={() => pick(tag)}
            style={[styles.chip, { backgroundColor: alpha(colors.sky, 0.14) }]}
          >
            <Text style={[styles.chipText, type.sansMedium, { color: colors.ink }]}>#{tag}</Text>
            {isReserved(tag) && (
              <Text style={[styles.hint, type.sans, { color: alpha(colors.ink, 0.45) }]}>
                {RESERVED_TAGS.find((r) => r.tag === tag)!.hint}
              </Text>
            )}
          </PressableScale>
        ))}

        {canCreate && (
          <PressableScale
            scaleTo={0.93}
            accessibilityLabel={`Create the tag ${query}`}
            onPress={() => pick(query)}
            style={[styles.chip, styles.create, { borderColor: alpha(colors.zest, 0.6) }]}
          >
            <Plus size={12} color={colors.zest} strokeWidth={2.6} />
            <Text style={[styles.chipText, type.sansMedium, { color: colors.zest }]}>
              #{query}
            </Text>
          </PressableScale>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  create: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed" },
  chipText: { fontSize: 12.5 },
  hint: { fontSize: 10.5 },
});
