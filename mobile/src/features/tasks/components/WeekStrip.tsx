import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { addDays, localDate, mondayOf, toLocalNoon, weekOf } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The week ribbon: seven day chips in a pressed tray, chevrons to page weeks.
 * Today wears a zest dot; the chevron on the right unfolds the whole month.
 * The head row hosts `leading` (the view keys) on the left and the month +
 * year beside the unfold chevron on the right — one row, no stacking. */
export function WeekStrip({
  selected,
  onSelect,
  onToggleView,
  leading,
}: {
  selected: string;
  onSelect: (date: string) => void;
  onToggleView: () => void;
  leading?: ReactNode;
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
        {leading}
        <View style={styles.headRight}>
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
          <Text style={[styles.month, type.display, { color: colors.ink }]}>
            {monthName} <Text style={{ color: colors.inkMuted }}>{yearName}</Text>
          </Text>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Open the month"
            onPress={onToggleView}
            style={styles.toggleBtn}
          >
            <ChevronDown size={16} color={alpha(colors.inkMuted, 0.7)} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.tray, { backgroundColor: alpha(colors.ink, 0.04) }]}>
          <Pager dir={-1} onPress={() => setWeekAnchor((a) => addDays(a, -7))} />
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
                {/* Today reads bigger via a transform, so its cell keeps the
                    same layout height as the others — no stretched row. */}
                <Text
                  style={[
                    styles.chipDate,
                    type.display,
                    { color: isSelected ? colors.ink : colors.inkMuted },
                    isToday && [
                      type.displayBlack,
                      {
                        color: isSelected ? colors.ink : colors.zest,
                        transform: [{ scale: 1.3 }],
                      },
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
          <Pager dir={1} onPress={() => setWeekAnchor((a) => addDays(a, 7))} />
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  month: {
    fontSize: 14,
    letterSpacing: -0.2,
  },
  headRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backToToday: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  toggleBtn: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  // The pagers live INSIDE the pressed well, bookending the days.
  tray: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 4,
    gap: 2,
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
    lineHeight: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  chipDate: {
    fontSize: 18,
    lineHeight: 19,
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
