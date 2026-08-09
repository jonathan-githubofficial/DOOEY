import { Plus } from "lucide-react-native";
import { ScrollView, StyleSheet } from "react-native";
import { Key } from "@/components/surface";
import { useCardInk } from "@/features/workouts/hues";
import { usePalette } from "@/stores/theme";
import type { Tracker } from "../types";

/** What you are logging right now.
 *
 * It picks the composer's tracker and nothing else: the list underneath always
 * shows the whole day, every tracker at once, because "what did I do today" is
 * the question this page answers and a filter would hide the answer. */
export function TrackerStrip({
  trackers,
  selected,
  onSelect,
  onAdd,
}: {
  trackers: Tracker[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const colors = usePalette();
  const ink = useCardInk();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {trackers.map((t) => (
        <Key
          key={t.id}
          label={t.name}
          tint={ink(t.hue).stamp}
          selected={t.id === selected}
          accessibilityLabel={`Log ${t.name}`}
          onPress={() => onSelect(t.id)}
        />
      ))}
      <Key
        label="Track"
        icon={<Plus size={13} color={colors.inkMuted} />}
        accessibilityLabel="Track something new"
        onPress={onAdd}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
});
