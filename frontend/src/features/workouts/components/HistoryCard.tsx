import { StyleSheet, Text, View } from "react-native";
import { Stamp } from "@/components/surface";
import type { Menu } from "@/stores/sheet";
import { fontStyle } from "@/features/style/tokens";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { cardAir, leanOf } from "../card-metrics";
import { focusOf } from "../focus";
import { useCardInk } from "../hues";
import { useWorkoutPrefs } from "../store";
import { formatElapsed, workoutElapsed, workoutVolume, type Workout } from "../types";
import { useEmblem } from "../emblem";
import { CardFace, CardMenu, CardShell } from "./card-parts";

/** A finished session on the board. It wears the colour of what it trained
 * rather than a chosen one — history is a record, not something you restyle. */
export function HistoryCard({
  workout,
  index,
  isPR,
  onPress,
  menu,
}: {
  workout: Workout;
  index: number;
  isPR: boolean;
  onPress: () => void;
  menu: () => Menu;
}) {
  const colors = usePalette();
  const unit = useWorkoutPrefs((s) => s.unit);
  const ink = useCardInk();

  const started = new Date(workout.started_at);
  const day = started.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const dur = formatElapsed(workoutElapsed(workout, 0));
  const volume = workoutVolume(workout.entries);
  const count = workout.entries.length;
  const focus = focusOf(workout.entries);
  const hue = focus?.hueKey ?? "zest";
  const emblem = useEmblem([]);

  return (
    <CardShell
      hue={hue}
      emblem={emblem}
      lean={leanOf(index)}
      markSize={96}
      accessibilityLabel={`${workout.title}, ${day}`}
      onPress={onPress}
    >
      <CardMenu label={`${workout.title} options`} menu={menu} />
      <View style={styles.stamps}>
        <Stamp color={ink(hue).stamp} rotate={-3}>
          {day}
        </Stamp>
        {isPR && (
          <Stamp color={colors.clay} rotate={4}>
            PR
          </Stamp>
        )}
      </View>

      <CardFace
        hue={hue}
        air={cardAir(count)}
        titleSize={17}
        title={workout.title}
        meta={`${count} ${count === 1 ? "exercise" : "exercises"}`}
        tag={focus?.label ?? null}
      />

      <View style={[styles.stats, { borderTopColor: alpha(colors.rule, 0.6) }]}>
        <MiniStat label="time" value={dur} />
        <MiniStat
          label="volume"
          value={volume > 0 ? `${Math.round(volume).toLocaleString()} ${unit}` : "—"}
        />
      </View>
    </CardShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.miniStat}>
      <Text style={[fontStyle("fraunces", "700"), styles.miniValue, { color: colors.ink }]}>
        {value}
      </Text>
      <Text style={[type.sansMedium, styles.miniLabel, { color: colors.inkMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // The stamps stop short of the ⋯ rather than run under it.
  stamps: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingRight: 26 },
  stats: {
    marginTop: 12,
    paddingTop: 9,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 18,
  },
  miniStat: { gap: 1 },
  miniValue: { fontSize: 13.5, fontVariant: ["tabular-nums"] },
  miniLabel: { fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase" },
});
