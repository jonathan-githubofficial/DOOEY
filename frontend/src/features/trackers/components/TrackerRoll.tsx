import { StyleSheet, Text, View } from "react-native";
import { Eyebrow, Panel } from "@/components/surface";
import { useCardInk } from "@/features/workouts/hues";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { addDays } from "@/lib/dates";
import { useEntriesRange } from "../api";
import { daysStamped, streakOf } from "../album";
import { formatValue, type Entry, type Tracker } from "../types";

/** How far back a streak may be counted. Half a year is past the point where
 * the number stops being motivating and starts being a fact about you. */
const RUN_DAYS = 182;

/** What you have kept going.
 *
 * A streak is the one number in the app that is genuinely an achievement rather
 * than a measurement, so it gets the display face and its tracker's colour.
 * Nothing about it is stored: deleting an entry shortens the run, which is the
 * only honest way to count one.
 *
 * It asks for its own window rather than reading the month the calendar has
 * loaded. A streak that reset every time you paged back to July would be
 * worse than not showing one. */
export function TrackerRoll({ trackers, today }: { trackers: Tracker[]; today: string }) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const { data: entries } = useEntriesRange(addDays(today, -RUN_DAYS), addDays(today, 1));

  if (trackers.length === 0) return null;

  return (
    <Panel style={styles.panel}>
      <Eyebrow>the run</Eyebrow>
      {trackers.map((tracker, i) => {
        const days = daysStamped(entries ?? [], tracker.id);
        const streak = streakOf(days, today);
        const last = lastOf(entries ?? [], tracker.id);
        const shade = ink(tracker.hue);
        return (
          <View
            key={tracker.id}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: 1, borderTopColor: alpha(colors.rule, 0.5) },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: shade.solid }]} />
            <View style={styles.name}>
              <Text numberOfLines={1} style={[styles.label, type.sansMedium, { color: colors.ink }]}>
                {tracker.name}
              </Text>
              <Text style={[styles.sub, type.sans, { color: colors.inkMuted }]}>
                {days.size} {days.size === 1 ? "day" : "days"}
                {last ? ` · last ${lastReading(tracker, last)}` : ""}
              </Text>
            </View>
            {/* A run of nothing is not a zero to display, it is the absence of
                a run — the days count beside it already says so. */}
            {streak > 0 && (
              <View style={styles.streak}>
                <Text style={[styles.streakNum, type.display, { color: shade.stamp }]}>
                  {streak}
                </Text>
                <Text style={[styles.streakWord, type.sans, { color: colors.inkMuted }]}>
                  in a row
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </Panel>
  );
}

function lastOf(entries: Entry[], trackerId: string): Entry | null {
  // Entries arrive oldest first, so the last match is the most recent.
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].tracker === trackerId) return entries[i];
  }
  return null;
}

/** What "last" was: the measurement if the shape has one, the words otherwise. */
function lastReading(tracker: Tracker, entry: Entry): string {
  return formatValue(tracker, entry.value) || entry.body || "kept";
}

const styles = StyleSheet.create({
  panel: { padding: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  dot: { height: 10, width: 10, borderRadius: 999 },
  name: { flex: 1, minWidth: 0 },
  label: { fontSize: 15 },
  sub: { marginTop: 1, fontSize: 12 },
  streak: { alignItems: "flex-end" },
  streakNum: { fontSize: 22, letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  streakWord: { fontSize: 10, marginTop: -2 },
});
