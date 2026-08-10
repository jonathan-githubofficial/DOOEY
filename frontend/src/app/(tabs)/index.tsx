import { useRouter } from "expo-router";
import { ChevronDown, Minus, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, runOnJS, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { MenuButton } from "@/components/menu-button";
import { PressableScale } from "@/components/pressable-scale";
import { useLearningPrograms, useMaterializePrograms } from "@/features/learning/api";
import { useShadow } from "@/features/style/store";
import { usePrefetchAdjacentDays } from "@/features/tasks/api";
import { AgendaSheet } from "@/features/tasks/components/AgendaSheet";
import { MonthView } from "@/features/tasks/components/MonthView";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { ComposerSheet, TaskComposer } from "@/features/tasks/components/TaskComposer";
import { TimeboxSheet } from "@/features/tasks/components/TimeboxSheet";
import { WeekStrip } from "@/features/tasks/components/WeekStrip";
import { PX_DEFAULT, PX_MAX, PX_MIN, clampPx, snapPx } from "@/features/tasks/timeGrid";
import { localDate } from "@/lib/dates";
import { hapticTap } from "@/lib/haptics";
import { DOCK_GAP, useDockTop, usePagePadding } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import type { Menu } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import { dur } from "@/lib/motion";


// ── TUNING KNOBS ────────────────────────────────────────────────────────────
// The gap (px) between the date shelf and the top of the notebook. SMALLER =
// notebook sits HIGHER on the page. This is the one to nudge if the notebook
// feels too low.
const PAGE_TOP_GAP = 12;
// How far the notebook's box is held off the tab bar / dock island (the
// safe-area inset is added on top of this). It sets the frame, not the page:
// the page's own height comes from the scale below.
const PAGE_BOTTOM_CLEARANCE = Platform.OS === "web" ? 116 : 108;
// How much of the remaining planner area the notebook page fills (1 = all of
// it). Shrink it and the page gets shorter, leaving air beneath.
//
// This and PAGE_TOP_GAP move together: pixels taken off the gap are handed to
// the page, so lifting the notebook lengthens it instead of sliding it up and
// leaving the same amount of dead air at the bottom.
const PAGE_HEIGHT_SCALE = 0.925;

/** Two ways to look at a day: as a list, or against the clock. The month is
 * not one of them — it unfolds out of the date shelf.
 *
 * There was a Week here too. It was a third grid to maintain, it made the
 * shelf print its seven days twice, and it answered a question the month
 * already answers better: nobody plans a week by reading seven columns of
 * blocks on a phone. */
type Mode = "list" | "timeline";

const MODES: { key: Mode; label: string; symbol: string }[] = [
  { key: "list", label: "List", symbol: "list.bullet" },
  { key: "timeline", label: "Timeline", symbol: "clock" },
];

/** Today: the day, and the one place things go in.
 *
 * It is also the calendar — the day drawn two ways, the shelf paging weeks and
 * unfolding into the month — but it opens on the day, because a space called
 * Today that greets you with a grid of other days is arguing with its own name.
 * The stamp floating above the tab bar is how anything gets in: a task you owe
 * the day on one side of the drawer, a record of something the day already has
 * on the other. */
export default function Today() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const dockTop = useDockTop();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);
  const shadow = useShadow();
  const router = useRouter();

  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [shelf, setShelf] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  // The day, not the week: this space is called Today.
  const [mode, setMode] = useState<Mode>("list");
  // A programme pushed from a Claude Code session arrives as a record with no
  // tasks behind it. This is where its sessions become real work — mounted on
  // Today now that Projects is not a space, because the sessions *are* tasks
  // and this is the page that draws them.
  const { data: programs } = useLearningPrograms();
  useMaterializePrograms(programs);
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

  const openSlot = useCallback(
    (date: string, start: number) =>
      Platform.OS === "web"
        ? setSlot({ date, start })
        : router.push({ pathname: "/compose", params: { date, start: String(start) } }),
    [router],
  );

  // Two fingers zoom the time axis.
  //
  // The gesture stays on the UI thread and only tells React when the zoom
  // crosses a stop. It used to run `.runOnJS(true)` and `setPx` on every
  // update: a full re-layout of every tick, block and label per frame, with
  // the next gesture event queued behind it. That is what "steppy pinch"
  // actually was — not the animation, the render.
  const pinchBase = useSharedValue(PX_DEFAULT);
  const pxLive = useSharedValue(PX_DEFAULT);
  const commitPx = useCallback((next: number) => setPx(next), []);
  const pinch = Gesture.Pinch()
    .enabled(mode !== "list")
    .onStart(() => {
      pinchBase.value = pxLive.value;
    })
    .onUpdate((e) => {
      const next = snapPx(clampPx(pinchBase.value * e.scale));
      if (next === pxLive.value) return;
      pxLive.value = next;
      runOnJS(commitPx)(next);
    });

  // Room for the binder above the page and the pad edges below it, scaled by
  // the height knob.
  const pageH = Math.max(240, Math.round((vh - 34) * PAGE_HEIGHT_SCALE));

  // Stable across day changes, on purpose: the book memoises its pages on this
  // function's identity, so an inline arrow here would rebuild BOTH days on
  // every flip — the page being animated included. That inline arrow is what
  // made the flip stutter through two rounds of animation "fixes".
  const renderPage = useCallback(
    (d: string) =>
      mode === "list" ? (
        <AgendaSheet date={d} height={pageH} />
      ) : (
        <TimeboxSheet date={d} pxPerMin={px} height={pageH} onAddSlot={openSlot} />
      ),
    [mode, px, pageH, openSlot],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      {/* The week, then the notebook, and only the notebook is a card.
          There was a day plate above this for a while — the weekday large, the
          date, a count of what was left. Every one of those facts is already on
          the page: the strip says which day, the list says what is on it. It
          bought a hero at the cost of the vertical space the day itself needed.

          Nothing here carries `layout` either. A layout transition tweens a
          container's box while its children run their own entrances inside it
          (the page flip, the pad resize, the shelf's fade): animations on the
          same pixels, none aware of the others, and the stutter is them
          disagreeing about where the box is this frame. */}
      <View style={styles.strip}>
        <Animated.View key={shelf} entering={FadeIn.duration(dur.quick)}>
          {shelf === "week" ? (
            <WeekStrip
              selected={selected}
              onSelect={select}
              leading={<ViewPicker mode={mode} onChange={setMode} />}
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
      </View>

      {/* Every view lives in a pinned frame: the shelf and the page stay put,
          only the page's own content scrolls. */}
      <GestureDetector gesture={pinch}>
        <Animated.View
          collapsable={false}
          style={[
            styles.body,
            {
              paddingTop: PAGE_TOP_GAP,
              paddingBottom: Math.max(16 + liveInset, insets.bottom) + PAGE_BOTTOM_CLEARANCE,
            },
          ]}
          onLayout={(e) => setVh(e.nativeEvent.layout.height)}
        >
          {vh > 0 && (
            <PlannerBook page={selected} direction={direction} renderPage={renderPage} />
          )}
        </Animated.View>
      </GestureDetector>

      {/* Mouse users can't pinch — the web keeps the zoom stepper. */}
      {mode !== "list" && Platform.OS === "web" && (
        <View
          style={[
            styles.zoom,
            {
              bottom: dockTop + DOCK_GAP,
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

/** Which view you are in, and the way to another.
 *
 * It was a segmented control: three keys in a tray, all three always on screen,
 * eating the width the date shelf wanted. One button says the same thing — you
 * are in List — and hands the other two to the platform's own menu, which draws
 * its own tick beside the one you are on and needs no room until it is asked
 * for. On iOS that is a real UIMenu out of the button itself. */
function ViewPicker({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const colors = usePalette();
  const type = useType();
  const current = MODES.find((m) => m.key === mode)!;

  const menu = (): Menu => ({
    actions: MODES.map((m) => ({
      label: m.label,
      symbol: m.symbol,
      selected: m.key === mode,
      onPress: () => {
        hapticTap();
        onChange(m.key);
      },
    })),
  });

  return (
    <MenuButton
      label={`View: ${current.label}`}
      menu={menu}
      style={[styles.viewKey, { backgroundColor: alpha(colors.ink, 0.05) }]}
    >
      <View style={styles.viewKeyInner}>
        <Text style={[styles.viewKeyLabel, type.sansMedium, { color: colors.ink }]}>
          {current.label}
        </Text>
        <ChevronDown size={12} color={colors.inkMuted} />
      </View>
    </MenuButton>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  strip: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  shelfKey: { height: 30, width: 30, alignItems: "center", justifyContent: "center" },
  viewKey: { height: 30, borderRadius: 999, justifyContent: "center", paddingHorizontal: 11 },
  viewKeyInner: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewKeyLabel: { fontSize: 11 },
  body: {
    flex: 1,
    paddingHorizontal: 16,
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
