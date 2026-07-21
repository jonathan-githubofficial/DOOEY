import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { useShadow } from "@/features/style/store";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { MonthView } from "@/features/tasks/components/MonthView";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { ComposerSheet } from "@/features/tasks/components/TaskComposer";
import { TimeboxSheet } from "@/features/tasks/components/TimeboxSheet";
import { WeekGrid } from "@/features/tasks/components/WeekGrid";
import { addDays, localDate, toLocalNoon, weekOf } from "@/lib/dates";
import { PX_DEFAULT, PX_MAX, PX_MIN, clampPx } from "@/features/tasks/timeGrid";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

type CalView = "day" | "week" | "month";

/** The calendar: your days, weeks and months laid out in time — the mobile
 * take on the web Calendar page. */
export default function Calendar() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const shadow = useShadow();

  const [view, setView] = useState<CalView>("week");
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  // The tapped slot that opens the task drawer, Google-Calendar style.
  const [slot, setSlot] = useState<{ date: string; start: number } | null>(null);
  // Vertical time zoom (day + week grids), in px per minute.
  const [px, setPx] = useState(PX_DEFAULT);

  const week = weekOf(selected);
  const today = localDate();

  const go = (dir: -1 | 1) => {
    setDirection(dir);
    setSelected((d) => addDays(d, dir * (view === "day" ? 1 : 7)));
  };
  const openDay = (date: string) => {
    setDirection(date >= selected ? 1 : -1);
    setSelected(date);
    setView("day");
  };

  const weekLabel = `${toLocalNoon(week[0]).toLocaleDateString("en", { month: "short", day: "numeric" })} – ${toLocalNoon(week[6]).toLocaleDateString("en", { month: "short", day: "numeric" })}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 128 },
        ]}
      >
        <Masthead avatar={<PageDoodle page="calendar" />} title="Calendar" />

        <View style={styles.toolbar}>
          <ViewToggle
            view={view}
            onChange={(v) => {
              if (v === "month") setMonth(selected.slice(0, 7));
              setView(v);
            }}
          />
          {view !== "month" && (
            <View style={styles.nav}>
              {selected !== today && (
                <Pressable
                  onPress={() => {
                    setDirection(selected > today ? -1 : 1);
                    setSelected(today);
                  }}
                >
                  <Text style={[styles.todayBtn, type.sansMedium, { color: colors.zest }]}>
                    today
                  </Text>
                </Pressable>
              )}
              <PressableScale
                scaleTo={0.85}
                accessibilityLabel={view === "day" ? "Previous day" : "Previous week"}
                onPress={() => go(-1)}
                style={styles.navBtn}
              >
                <ChevronLeft size={16} color={alpha(colors.inkMuted, 0.7)} />
              </PressableScale>
              {view === "week" && (
                <Text style={[styles.weekLabel, type.sansMedium, { color: colors.inkMuted }]}>
                  {weekLabel}
                </Text>
              )}
              <PressableScale
                scaleTo={0.85}
                accessibilityLabel={view === "day" ? "Next day" : "Next week"}
                onPress={() => go(1)}
                style={styles.navBtn}
              >
                <ChevronRight size={16} color={alpha(colors.inkMuted, 0.7)} />
              </PressableScale>
            </View>
          )}
        </View>

        {view === "day" && (
          <View style={styles.dayBook}>
            <PlannerBook page={selected} direction={direction}>
              <TimeboxSheet
                date={selected}
                pxPerMin={px}
                onAddSlot={(date, start) => setSlot({ date, start })}
              />
            </PlannerBook>
          </View>
        )}

        {view === "week" && (
          <Animated.View key={week[0]} entering={FadeIn.duration(200)} style={styles.viewBody}>
            <Panel style={styles.gridPanel}>
              <WeekGrid anchor={selected} pxPerMin={px} onPickDay={openDay} />
            </Panel>
          </Animated.View>
        )}

        {view === "month" && (
          <Animated.View entering={FadeInDown.duration(180)} style={styles.viewBody}>
            <Panel style={styles.gridPanel}>
              <MonthView month={month} onMonth={setMonth} selected={selected} onSelect={openDay} />
            </Panel>
          </Animated.View>
        )}
      </ScrollView>

      {/* Time zoom: taller hours on +, more of the day on −. */}
      {view !== "month" && (
        <View
          style={[
            styles.zoom,
            {
              bottom: Math.max(16, insets.bottom) + 64,
              backgroundColor: alpha(colors.surface, 0.95),
              borderColor: alpha(colors.rule, 0.7),
              shadowOpacity: 0.1 * shadow,
            },
          ]}
        >
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Zoom in"
            disabled={px >= PX_MAX - 0.001}
            onPress={() => setPx((p) => clampPx(p * 1.4))}
            style={[styles.zoomBtn, px >= PX_MAX - 0.001 && { opacity: 0.3 }]}
          >
            <Plus size={16} color={colors.ink} />
          </PressableScale>
          <View style={[styles.zoomDivider, { backgroundColor: alpha(colors.rule, 0.7) }]} />
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Zoom out"
            disabled={px <= PX_MIN + 0.001}
            onPress={() => setPx((p) => clampPx(p / 1.4))}
            style={[styles.zoomBtn, px <= PX_MIN + 0.001 && { opacity: 0.3 }]}
          >
            <Minus size={16} color={colors.ink} />
          </PressableScale>
        </View>
      )}

      {/* Tap a slot → the task drawer opens at that time. */}
      {slot && (
        <ComposerSheet date={slot.date} initialStart={slot.start} onClose={() => setSlot(null)} />
      )}
    </View>
  );
}

/** Day / Week / Month — keys in the same pressed tray the planner uses. */
function ViewToggle({ view, onChange }: { view: CalView; onChange: (v: CalView) => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={[styles.toggleWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
      {(["day", "week", "month"] as const).map((v) => (
        <PressableScale
          key={v}
          scaleTo={0.95}
          accessibilityState={{ selected: view === v }}
          onPress={() => onChange(v)}
          style={[
            styles.toggleBtn,
            view === v && {
              backgroundColor: colors.surface,
              borderColor: alpha(colors.rule, 0.7),
              borderWidth: 1,
            },
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              type.sansMedium,
              { color: view === v ? colors.ink : colors.inkMuted },
            ]}
          >
            {v}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  toolbar: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  toggleWell: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
  },
  toggleBtn: {
    height: 28,
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 14,
  },
  toggleText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  todayBtn: {
    marginRight: 4,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  navBtn: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  weekLabel: {
    minWidth: 112,
    textAlign: "center",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  dayBook: {
    marginTop: 36,
  },
  viewBody: {
    marginTop: 16,
  },
  gridPanel: {
    padding: 16,
  },
  zoom: {
    position: "absolute",
    right: 16,
    zIndex: 30,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#282018",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  zoomBtn: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: {
    height: 1,
    marginHorizontal: 10,
  },
});
