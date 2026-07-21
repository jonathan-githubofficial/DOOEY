import { useRouter } from "expo-router";
import { Minus, Plus } from "lucide-react-native";
import { useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(380).damping(34);

// ── TUNING KNOBS ────────────────────────────────────────────────────────────
// How far the notebook's bottom edge sits ABOVE the tab bar / dock island
// (safe-area inset is added on top of this). Bigger = higher notebook, more
// room for the companion peeking over the page edge.
const PAGE_BOTTOM_CLEARANCE = Platform.OS === "web" ? 116 : 108;
// How much of the remaining planner area the notebook page fills (1 = all of
// it). Shrink it and the page gets shorter, leaving air beneath.
const PAGE_HEIGHT_SCALE = 0.94;

/** How the day's work is laid out: the agenda list, the timeboxed day grid,
 * or the whole week in time. The month is not a mode — it unfolds out of the
 * date shelf. */
type Mode = "agenda" | "day" | "week";

const MODES: { key: Mode; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
];

/** The planner IS the calendar: one space, three ways to look at your time.
 * The date shelf up top pages weeks, unfolds into the month, and carries the
 * view keys; the new-task stamp floats above the tab bar. Switching days
 * flips the page over the rings, desk-calendar style. */
export default function Planner() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const shadow = useShadow();
  const router = useRouter();

  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [shelf, setShelf] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [mode, setMode] = useState<Mode>("agenda");
  // Vertical time zoom (day + week grids), in px per minute.
  const [px, setPx] = useState(PX_DEFAULT);
  // The height the time grids get to live in — they scroll inside it.
  const [vh, setVh] = useState(0);
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

  // Two fingers zoom the time axis, exactly like the legacy web grid.
  const pinchBase = useRef(PX_DEFAULT);
  const pinch = Gesture.Pinch()
    .enabled(mode !== "agenda")
    .runOnJS(true)
    .onStart(() => {
      pinchBase.current = px;
    })
    .onUpdate((e) => setPx(clampPx(pinchBase.current * e.scale)));

  // Room for the binder above the page and the pad edges below it, scaled by
  // the height knob.
  const pageH = Math.max(240, Math.round((vh - 34) * PAGE_HEIGHT_SCALE));

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
                leading={
                  <ModeToggle
                    mode={mode}
                    onChange={(m) => {
                      hapticTap();
                      setMode(m);
                    }}
                  />
                }
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

      {/* Every view lives in a pinned frame: the shelf and the page stay put,
          only the page's own content scrolls. */}
      <GestureDetector gesture={pinch}>
        <Animated.View
          layout={settle}
          collapsable={false}
          style={[
            styles.body,
            { paddingBottom: Math.max(16, insets.bottom) + PAGE_BOTTOM_CLEARANCE },
          ]}
          onLayout={(e) => setVh(e.nativeEvent.layout.height)}
        >
          {vh > 0 && mode !== "week" && (
            <PlannerBook
              page={selected}
              direction={direction}
              renderPage={(d) =>
                mode === "agenda" ? (
                  <AgendaSheet date={d} height={pageH} />
                ) : (
                  <TimeboxSheet date={d} pxPerMin={px} height={pageH} onAddSlot={openSlot} />
                )
              }
            />
          )}
          {vh > 0 && mode === "week" && (
            <Animated.View key={selected} entering={FadeIn.duration(200)}>
              <Panel style={[styles.gridPanel, { height: Math.round(vh * PAGE_HEIGHT_SCALE) }]}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.gridScroll}
                >
                  <WeekGrid
                    anchor={selected}
                    pxPerMin={px}
                    onPickDay={(d) => {
                      select(d);
                      setMode("day");
                    }}
                  />
                </ScrollView>
              </Panel>
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Mouse users can't pinch — the web keeps the zoom stepper. */}
      {mode !== "agenda" && Platform.OS === "web" && (
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

/** The view keys: plain words in the pressed tray, the active one raised to
 * a paper key. */
function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={[styles.toggleWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
      {MODES.map(({ key, label }) => {
        const active = mode === key;
        return (
          <PressableScale
            key={key}
            scaleTo={0.93}
            accessibilityLabel={`${label} view`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            style={[
              styles.toggleKey,
              active && {
                backgroundColor: colors.surface,
                borderColor: alpha(colors.rule, 0.7),
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.toggleLabel,
                type.sansMedium,
                { color: active ? colors.ink : colors.inkMuted },
              ]}
            >
              {label}
            </Text>
          </PressableScale>
        );
      })}
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
  toggleWell: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  toggleKey: {
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  toggleLabel: {
    fontSize: 11,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  gridScroll: {
    paddingBottom: 8,
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
