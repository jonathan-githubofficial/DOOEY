import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useCardInk } from "../hues";
import type { RhythmDay } from "../rotation";

/** Monday first, the week the planner and the gym both start on. */
export const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const KEY_H = 30;
const PAST_H = 13;

/** One day: tinted with what you trained, and a way into the session when
 * there is one.
 *
 * The two sizes are not the same drawing scaled. This week's keys are the
 * control they always were — dashed outlines for the days still open, a solid
 * ring on today. The weeks behind are a *field*: a rest day back there is a
 * flat wash, because five rows of dashed outlines is noise, and the thing you
 * are meant to read at that zoom is where the colour is and where it isn't.
 *
 * Shared, because the same cell has to mean the same thing in the ticket's one
 * row and in the history page's six months of them. */
export function DayCell({
  day,
  compact,
  letter,
  onOpen,
}: {
  day: RhythmDay;
  compact?: boolean;
  letter?: string;
  onOpen: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const hit = day.hueKey ? ink(day.hueKey).solid : null;

  const face = (
    <View
      style={[
        styles.key,
        compact ? { height: PAST_H, borderRadius: 3 } : { height: KEY_H, borderRadius: 9 },
        hit
          ? { backgroundColor: hit }
          : compact
            ? { backgroundColor: alpha(colors.ink, 0.05) }
            : { borderWidth: 1.2, borderStyle: "dashed", borderColor: colors.rule },
        day.isToday && !hit && !compact && { borderStyle: "solid", borderColor: colors.ink },
      ]}
    >
      {!!letter && (
        <Text
          style={[
            type.sansSemiBold,
            styles.keyText,
            { color: hit ? colors.surface : day.isToday ? colors.ink : colors.inkMuted },
          ]}
        >
          {letter}
        </Text>
      )}
    </View>
  );

  if (!day.workoutId) return <View style={styles.cell}>{face}</View>;
  const when = day.date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return (
    <PressableScale
      scaleTo={0.88}
      accessibilityLabel={`Open the session from ${when}`}
      onPress={() => {
        hapticTap();
        onOpen(day.workoutId!);
      }}
      style={styles.cell}
    >
      {face}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  key: { alignItems: "center", justifyContent: "center" },
  keyText: { fontSize: 11, letterSpacing: 0.4 },
});
