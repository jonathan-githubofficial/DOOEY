import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { addDays, localDate, pad2, toLocalNoon } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useMonthOpenCounts } from "../api";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** The month grid: every day at a glance, with zest dots for open tasks.
 * Tap a day to open it. */
export function MonthView({
  month,
  onMonth,
  selected,
  onSelect,
}: {
  month: string; // YYYY-MM
  onMonth: (m: string) => void;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const { data: counts = {} } = useMonthOpenCounts(month);
  const today = localDate();

  const first = `${month}-01`;
  const firstNoon = toLocalNoon(first);
  const mondayOffset = (firstNoon.getDay() + 6) % 7;
  const daysInMonth = new Date(firstNoon.getFullYear(), firstNoon.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);
  const gridStart = addDays(first, -mondayOffset);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  const shiftMonth = (delta: number) => {
    const d = new Date(firstNoon);
    d.setMonth(d.getMonth() + delta);
    onMonth(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
  };

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.month, type.display, { color: colors.ink }]}>
          {firstNoon.toLocaleDateString("en", { month: "long" })}{" "}
          <Text style={{ color: colors.inkMuted }}>{firstNoon.getFullYear()}</Text>
        </Text>
        <View style={styles.nav}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Previous month"
            onPress={() => shiftMonth(-1)}
            style={styles.navBtn}
          >
            <ChevronLeft size={16} color={alpha(colors.inkMuted, 0.7)} />
          </PressableScale>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Next month"
            onPress={() => shiftMonth(1)}
            style={styles.navBtn}
          >
            <ChevronRight size={16} color={alpha(colors.inkMuted, 0.7)} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={[styles.weekday, type.sansMedium, { color: colors.inkMuted }]}>
            {w}
          </Text>
        ))}
      </View>
      <View style={[styles.grid, { backgroundColor: alpha(colors.ink, 0.04) }]}>
        {cells.map((d) => {
          const inMonth = d.startsWith(month);
          const isSelected = d === selected;
          const isToday = d === today;
          const taskDots = Math.min(counts[d] ?? 0, 3);
          return (
            <PressableScale
              key={d}
              onPress={() => onSelect(d)}
              accessibilityLabel={toLocalNoon(d).toLocaleDateString("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              style={[
                styles.cell,
                isSelected && {
                  backgroundColor: colors.surface,
                  borderColor: alpha(colors.rule, 0.7),
                  borderWidth: 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.cellDate,
                  type.display,
                  { color: inMonth ? colors.ink : alpha(colors.inkMuted, 0.4) },
                  isToday && { color: colors.zest },
                ]}
              >
                {Number(d.slice(8))}
              </Text>
              <View style={styles.dots}>
                {Array.from({ length: taskDots }).map((_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: alpha(colors.zest, 0.8) }]} />
                ))}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  month: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  nav: {
    flexDirection: "row",
    gap: 4,
  },
  navBtn: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdays: {
    marginTop: 8,
    flexDirection: "row",
    paddingHorizontal: 6,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    paddingBottom: 4,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 16,
    padding: 4,
  },
  cell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  cellDate: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  dots: {
    marginTop: 3,
    height: 4,
    flexDirection: "row",
    gap: 2,
  },
  dot: {
    height: 4,
    width: 4,
    borderRadius: 999,
  },
});
