import { Image, StyleSheet, Text, View } from "react-native";
import { DoodleSvg } from "@/components/DoodleSvg";
import { PressableScale } from "@/components/pressable-scale";
import { useCardRadius } from "@/features/style/store";
import { useCardInk } from "@/features/workouts/hues";
import type { Stroke } from "@/lib/doodle";
import { hapticTap } from "@/lib/haptics";
import { toLocalNoon } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import type { AlbumDay } from "../album";

/** Monday first, the week the planner and the gym both start on. */
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** At most this many marks in a square. A seventh tracker on one day makes the
 * dots too small to be a colour, so the overflow is counted instead. */
const MAX_MARKS = 5;

/** What a day has to show for itself, gathered by the page and handed down so
 * the square does not go looking for anything. */
export interface DayArt {
  photos: string[];
  doodle: Stroke[] | undefined;
}

/** A month of squares.
 *
 * The point is that it is *looked at*, not read. A day you drew on, trained, or
 * photographed shows the thing itself; a day you only logged shows its colours;
 * a day with nothing shows nothing, and the shape of those gaps is most of the
 * information on the page. */
export function AlbumGrid({
  rows,
  art,
  selected,
  onPick,
}: {
  rows: AlbumDay[][];
  art: (date: string) => DayArt;
  selected: string;
  onPick: (date: string) => void;
}) {
  const colors = usePalette();
  const type = useType();

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {LETTERS.map((l, i) => (
          <View key={i} style={styles.cell}>
            <Text style={[styles.letter, type.sansMedium, { color: alpha(colors.inkMuted, 0.7) }]}>
              {l}
            </Text>
          </View>
        ))}
      </View>
      {rows.map((week) => (
        <View key={week[0].date} style={styles.row}>
          {week.map((day) => (
            <DaySquare
              key={day.date}
              day={day}
              art={art(day.date)}
              selected={day.date === selected}
              onPress={() => onPick(day.date)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function DaySquare({
  day,
  art,
  selected,
  onPress,
}: {
  day: AlbumDay;
  art: DayArt;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const radius = useCardRadius();
  // A square is small; past about a third of its side the corners eat the
  // picture inside it.
  const corner = Math.min(radius, 12);

  const photo = art.photos[0];
  const doodle = art.doodle?.length ? art.doodle : null;
  const marks = day.hues.slice(0, MAX_MARKS);
  const over = day.hues.length - marks.length;
  const empty = !photo && !doodle && day.hues.length === 0 && !day.workoutId;

  const face = (
    <View
      style={[
        styles.square,
        {
          borderRadius: corner,
          backgroundColor: day.ahead || day.outside ? "transparent" : alpha(colors.ink, 0.05),
          borderColor: selected ? colors.ink : day.isToday ? alpha(colors.ink, 0.5) : "transparent",
          borderWidth: selected || day.isToday ? 1.4 : 0,
        },
        day.outside && styles.outside,
      ]}
    >
      {/* The picture fills the square and everything else sits over it. */}
      {!!photo && (
        <Image source={{ uri: photo }} style={[styles.photo, { borderRadius: corner }]} />
      )}
      {!photo && !!doodle && (
        <View style={styles.doodle}>
          <DoodleSvg strokes={doodle} strokeWidth={6} opacity={0.75} />
        </View>
      )}

      <Text
        style={[
          styles.numeral,
          type.sansMedium,
          {
            color: photo ? colors.paper : day.isToday ? colors.ink : alpha(colors.inkMuted, 0.8),
          },
        ]}
      >
        {day.day}
      </Text>

      <View style={styles.marks}>
        {/* Training is a bar rather than a dot: it is a different kind of thing
            from a stamp, and a sixth colour would only say "some tracker". */}
        {!!day.workoutId && (
          <View style={[styles.bar, { backgroundColor: photo ? colors.paper : colors.ink }]} />
        )}
        {marks.map((hue, i) => (
          <View key={i} style={[styles.mark, { backgroundColor: ink(hue).solid }]} />
        ))}
        {over > 0 && (
          <Text
            style={[styles.over, type.sansMedium, { color: photo ? colors.paper : colors.inkMuted }]}
          >
            +{over}
          </Text>
        )}
      </View>
    </View>
  );

  if (day.ahead || empty) return <View style={styles.cell}>{face}</View>;

  const when = toLocalNoon(day.date).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
  });
  return (
    <PressableScale
      scaleTo={0.9}
      accessibilityLabel={`${when}: ${day.count} ${day.count === 1 ? "stamp" : "stamps"}`}
      accessibilityState={{ selected }}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={styles.cell}
    >
      {face}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 4 },
  row: { flexDirection: "row", gap: 4 },
  cell: { flex: 1 },
  square: { aspectRatio: 0.82, overflow: "hidden", padding: 4, justifyContent: "space-between" },
  outside: { opacity: 0.35 },
  photo: { ...StyleSheet.absoluteFillObject },
  doodle: { ...StyleSheet.absoluteFillObject, padding: 3 },
  numeral: { fontSize: 10, fontVariant: ["tabular-nums"], letterSpacing: 0.2 },
  marks: { flexDirection: "row", flexWrap: "wrap", gap: 2, alignItems: "center" },
  mark: { height: 5, width: 5, borderRadius: 999 },
  bar: { height: 5, width: 2, borderRadius: 999 },
  over: { fontSize: 7 },
  letter: { fontSize: 9, textAlign: "center", letterSpacing: 0.6, marginBottom: 2 },
});
