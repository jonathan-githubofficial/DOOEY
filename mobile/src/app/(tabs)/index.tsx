import { useRouter } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { useShadow } from "@/features/style/store";
import { usePrefetchAdjacentDays } from "@/features/tasks/api";
import { AgendaSheet } from "@/features/tasks/components/AgendaSheet";
import { MonthView } from "@/features/tasks/components/MonthView";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { ComposerSheet, TaskComposer } from "@/features/tasks/components/TaskComposer";
import { TimeboxSheet } from "@/features/tasks/components/TimeboxSheet";
import { WeekGrid } from "@/features/tasks/components/WeekGrid";
import { WeekStrip } from "@/features/tasks/components/WeekStrip";
import { PX_DEFAULT, PX_MAX, PX_MIN, clampPx } from "@/features/tasks/timeGrid";
import { localDate } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(380).damping(34);

/** How the day's work is laid out: the agenda list, the timeboxed day grid,
 * or the whole week in time. The month is not a mode — it unfolds out of the
 * date shelf. */
type Mode = "list" | "day" | "week";

/** The planner IS the calendar: one space, three ways to look at your time.
 * The date shelf up top pages weeks and unfolds into the month; the toggle
 * picks list / day / week; the new-task stamp floats above the tab bar.
 * Switching days flips the page over the rings, desk-calendar style. */
export default function Planner() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const shadow = useShadow();
  const router = useRouter();

  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [shelf, setShelf] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [mode, setMode] = useState<Mode>("list");
  // Vertical time zoom (day + week grids), in px per minute.
  const [px, setPx] = useState(PX_DEFAULT);
  // The tapped slot opens the task form at that time, Google-Calendar style —
  // as the system sheet on native, as the web drawer on web.
  const [slot, setSlot] = useState<{ date: string; start: number } | null>(null);
  usePrefetchAdjacentDays(selected);

  const select = (date: string) => {
    if (date === selected) return;
    setDirection(date > selected ? 1 : -1);
    setSelected(date);
  };

  const openSlot = (date: string, start: number) =>
    Platform.OS === "web"
      ? setSlot({ date, start })
      : router.push({ pathname: "/compose", params: { date, start: String(start) } });

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
      <Grain />
      <Animated.View layout={settle} style={styles.strip}>
        <Panel style={styles.stripPanel}>
          <Animated.View key={shelf} entering={FadeIn.duration(180)}>
            {shelf === "week" ? (
              <WeekStrip
                selected={selected}
                onSelect={select}
                onToggleView={() => {
                  setMonth(selected.slice(0, 7));
                  setShelf("month");
                }}
              />
            ) : (
              <MonthView
                month={month}
                onMonth={setMonth}
                selected={selected}
                onSelect={(d) => {
                  select(d);
                  setShelf("week");
                }}
                onToggleView={() => setShelf("week")}
              />
            )}
          </Animated.View>
        </Panel>
      </Animated.View>

      <View style={styles.modeRow}>
        <ModeToggle mode={mode} onChange={setMode} />
      </View>

      {/* The pad glides down as the shelf unfolds — same settle as the shelf. */}
      <Animated.View layout={settle} style={styles.scroll}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(16, insets.bottom) + 128 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {mode === "week" ? (
            <Animated.View key={selected} entering={FadeIn.duration(200)}>
              <Panel style={styles.gridPanel}>
                <WeekGrid
                  anchor={selected}
                  pxPerMin={px}
                  onPickDay={(d) => {
                    select(d);
                    setMode("day");
                  }}
                />
              </Panel>
            </Animated.View>
          ) : (
            <PlannerBook
              page={selected}
              direction={direction}
              renderPage={(d) =>
                mode === "list" ? (
                  <AgendaSheet date={d} />
                ) : (
                  <TimeboxSheet date={d} pxPerMin={px} onAddSlot={openSlot} />
                )
              }
            />
          )}
        </ScrollView>
      </Animated.View>

      {/* Time zoom: taller hours on +, more of the day on −. */}
      {mode !== "list" && (
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

      <TaskComposer date={selected} />

      {/* Web slot-tap fallback — native pushes the /compose form sheet. */}
      {slot && (
        <ComposerSheet date={slot.date} initialStart={slot.start} onClose={() => setSlot(null)} />
      )}
    </View>
  );
}

/** List / Day / Week — keys in the same pressed tray the shelf uses. */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={[styles.toggleWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
      {(["list", "day", "week"] as const).map((m) => (
        <PressableScale
          key={m}
          scaleTo={0.95}
          accessibilityState={{ selected: mode === m }}
          onPress={() => onChange(m)}
          style={[
            styles.toggleBtn,
            mode === m && {
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
              { color: mode === m ? colors.ink : colors.inkMuted },
            ]}
          >
            {m}
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
  strip: {
    paddingHorizontal: 16,
  },
  stripPanel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toggleWell: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
  },
  toggleBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  gridPanel: {
    padding: 12,
  },
  zoom: {
    position: "absolute",
    left: 16,
    zIndex: 30,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#282018",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  zoomBtn: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
  },
});
