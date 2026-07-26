import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { localDate, toLocalNoon, weekOf } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDayTasks } from "../api";
import { DAY_END, DAY_START, fmtMin, layoutLanes } from "../timeGrid";

const WEEK_GUTTER = 28; // slimmer ruler than the day sheet — seven columns need the room

/** The week as seven ruled columns. Blocks are read-only at this size — tap a
 * day's header to open it as a full sheet. */
export function WeekGrid({
  anchor,
  pxPerMin,
  onPickDay,
}: {
  anchor: string;
  pxPerMin: number;
  onPickDay: (date: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const days = weekOf(anchor);
  const today = localDate();
  const height = (DAY_END - DAY_START) * pxPerMin;

  return (
    <View>
      <View style={[styles.headerRow, { paddingLeft: WEEK_GUTTER }]}>
        {days.map((d) => {
          const noon = toLocalNoon(d);
          const isToday = d === today;
          return (
            <PressableScale
              key={d}
              onPress={() => onPickDay(d)}
              accessibilityLabel={`Open ${noon.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}`}
              style={styles.headerCell}
            >
              <Text style={[styles.headerDow, type.sansMedium, { color: colors.inkMuted }]}>
                {noon.toLocaleDateString("en", { weekday: "narrow" })}
              </Text>
              <Text
                style={[
                  styles.headerDate,
                  type.display,
                  { color: isToday ? colors.zest : colors.ink },
                ]}
              >
                {noon.getDate()}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={{ height }}>
        <HourRules pxPerMin={pxPerMin} />
        <View style={[styles.columns, { left: WEEK_GUTTER }]}>
          {days.map((d, i) => (
            <View
              key={d}
              style={[
                styles.column,
                i > 0 && { borderLeftWidth: 1, borderLeftColor: alpha(colors.rule, 0.35) },
              ]}
            >
              <DayColumn date={d} pxPerMin={pxPerMin} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function HourRules({ pxPerMin }: { pxPerMin: number }) {
  const colors = usePalette();
  const type = useType();
  const hours = Array.from(
    { length: (DAY_END - DAY_START) / 60 + 1 },
    (_, i) => DAY_START + i * 60,
  );
  return (
    <>
      {hours.map((m) => (
        <View key={m} pointerEvents="none" style={[styles.tick, { top: (m - DAY_START) * pxPerMin }]}>
          <Text style={[styles.tickLabel, type.sansMedium, { color: alpha(colors.inkMuted, 0.6) }]}>
            {fmtMin(m).toUpperCase()}
          </Text>
          <View
            style={{
              marginLeft: WEEK_GUTTER,
              borderTopWidth: 1,
              borderTopColor: alpha(colors.rule, 0.5),
            }}
          />
        </View>
      ))}
    </>
  );
}

/** One day's scheduled slips, packed into lanes at week scale. */
function DayColumn({ date, pxPerMin }: { date: string; pxPerMin: number }) {
  const colors = usePalette();
  const type = useType();
  const { data: tasks } = useDayTasks(date);
  const scheduled = (tasks ?? []).filter((t) => !t.done_at && t.start_min > 0);
  const lanes = layoutLanes(
    scheduled.map((t) => ({ id: t.id, start_min: t.start_min, dur_min: t.dur_min })),
  );

  return (
    <>
      {scheduled.map((t) => {
        const lane = lanes.get(t.id) ?? { lane: 0, lanes: 1 };
        const blockHeight = t.dur_min * pxPerMin;
        return (
          <View
            key={t.id}
            style={[
              styles.block,
              {
                top: (t.start_min - DAY_START) * pxPerMin,
                height: blockHeight,
                left: `${(lane.lane / lane.lanes) * 100}%`,
                width: `${100 / lane.lanes}%`,
                backgroundColor: alpha(colors.zest, 0.12),
                borderColor: alpha(colors.zest, 0.35),
              },
            ]}
          >
            {blockHeight >= 18 && (
              <Text
                numberOfLines={1}
                style={[styles.blockText, type.sansMedium, { color: colors.ink }]}
              >
                {t.title}
              </Text>
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    alignItems: "center",
    gap: 1,
    paddingVertical: 2,
  },
  headerDow: {
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerDate: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  columns: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: "row",
  },
  column: {
    flex: 1,
  },
  tick: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  tickLabel: {
    position: "absolute",
    top: -4,
    left: 0,
    width: WEEK_GUTTER - 6,
    textAlign: "right",
    fontSize: 7,
    fontVariant: ["tabular-nums"],
  },
  block: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingTop: 1,
    overflow: "hidden",
  },
  blockText: {
    fontSize: 9,
  },
});
