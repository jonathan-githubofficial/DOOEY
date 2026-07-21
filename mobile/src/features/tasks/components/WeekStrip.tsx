import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { addDays, localDate, mondayOf, toLocalNoon, weekOf } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The week ribbon: seven day chips in a pressed tray, chevrons to page weeks.
 * Today wears a zest dot. */
export function WeekStrip({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (date: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const [weekAnchor, setWeekAnchor] = useState(selected);
  const days = weekOf(weekAnchor);
  const today = localDate();
  const monthLabel = toLocalNoon(days[3]).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });
  const [monthName, yearName] = monthLabel.split(" ");
  const todayInView = mondayOf(today) === mondayOf(weekAnchor);

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.month, type.display, { color: colors.ink }]}>
          {monthName} <Text style={{ color: colors.inkMuted }}>{yearName}</Text>
        </Text>
        {!todayInView && (
          <Pressable
            onPress={() => {
              setWeekAnchor(today);
              onSelect(today);
            }}
          >
            <Text style={[styles.backToToday, type.sansMedium, { color: colors.zest }]}>
              back to today
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.row}>
        <Pager dir={-1} onPress={() => setWeekAnchor((a) => addDays(a, -7))} />
        <View style={[styles.tray, { backgroundColor: alpha(colors.ink, 0.04) }]}>
          {days.map((d) => {
            const isSelected = d === selected;
            const isToday = d === today;
            const noon = toLocalNoon(d);
            return (
              <PressableScale
                key={d}
                onPress={() => onSelect(d)}
                accessibilityLabel={noon.toLocaleDateString("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                style={[
                  styles.chip,
                  isSelected && {
                    backgroundColor: colors.surface,
                    borderColor: alpha(colors.rule, 0.7),
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipDow,
                    type.sansMedium,
                    { color: isSelected ? colors.ink : colors.inkMuted },
                  ]}
                >
                  {noon.toLocaleDateString("en", { weekday: "narrow" })}
                </Text>
                <Text
                  style={[
                    styles.chipDate,
                    type.display,
                    { color: isSelected ? colors.ink : colors.inkMuted },
                    isToday && [
                      type.displayBlack,
                      { fontSize: 22, color: isSelected ? colors.ink : colors.zest },
                    ],
                  ]}
                >
                  {noon.getDate()}
                </Text>
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: isToday ? colors.zest : "transparent" },
                  ]}
                />
              </PressableScale>
            );
          })}
        </View>
        <Pager dir={1} onPress={() => setWeekAnchor((a) => addDays(a, 7))} />
      </View>
    </View>
  );
}

function Pager({ dir, onPress }: { dir: -1 | 1; onPress: () => void }) {
  const colors = usePalette();
  const Icon = dir === -1 ? ChevronLeft : ChevronRight;
  return (
    <PressableScale
      scaleTo={0.85}
      onPress={onPress}
      accessibilityLabel={dir === -1 ? "Previous week" : "Next week"}
      style={styles.pager}
    >
      <Icon size={16} color={alpha(colors.inkMuted, 0.6)} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  month: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  backToToday: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  row: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tray: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    borderRadius: 12,
    paddingVertical: 6,
  },
  chipDow: {
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  chipDate: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  chipDot: {
    height: 4,
    width: 4,
    borderRadius: 999,
  },
  pager: {
    height: 36,
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
