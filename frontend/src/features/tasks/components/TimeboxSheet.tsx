import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { Check } from "@/components/Check";
import { Eyebrow } from "@/components/surface";
import { useShadow } from "@/features/style/store";
import { useNowMinutes } from "@/lib/clock";
import { localDate } from "@/lib/dates";
import { hapticLift, hapticSuccess } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDayTasks, useUpdateTask } from "../api";
import { DAY_END, DAY_START, GUTTER, SNAP, clamp, fmtMin, layoutLanes, snap } from "../timeGrid";
import type { Task } from "../types";
import { PageSheet } from "./AgendaSheet";
import { dur, settle, timing } from "@/lib/motion";


/** How a slip dropped on nothing returns to the shelf. */
const HOME = { stiffness: 420, damping: 34 };

/** The day as a ruled sheet of hours. Blocks are paper slips pinned to their
 * slots; unscheduled work waits on a shelf above. **Hold a slip and drag it
 * onto an hour** to give it that time, or tap the slip and then the hour when
 * the hour you want is off the bottom of the screen. Tap an empty hour to box
 * in a brand-new task. */
export function TimeboxSheet({
  date,
  pxPerMin,
  height,
  onAddSlot,
}: {
  date: string;
  pxPerMin: number;
  height?: number;
  onAddSlot: (date: string, startMin: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const { data: tasks, isPending, error } = useDayTasks(date);
  const update = useUpdateTask();
  const [placing, setPlacing] = useState<string | null>(null);
  // An animated ref, so a dragging slip can `measure()` the grid on the UI
  // thread mid-gesture: the finger's position and the grid's are then read in
  // the same frame, which is what makes a drop land where it looks like it
  // will even if the day has been scrolled.
  const gridRef = useAnimatedRef<View>();
  // Which hour a drag is hovering. A shared value, because a drop line driven
  // by React state would re-render every block on the day at 60fps to move one
  // hairline.
  const hoverMin = useSharedValue(-1);

  /** A worklet, and the parent's to own: the drop line belongs to this grid, so
   * a dragging slip reports the hour it is over rather than reaching in and
   * setting it. */
  const showDrop = useCallback(
    (min: number) => {
      "worklet";
      hoverMin.value = min;
    },
    [hoverMin],
  );

  const dropAt = useCallback(
    (id: string, start_min: number) => {
      hapticSuccess();
      update.mutate({ id, patch: { start_min } });
      setPlacing(null);
    },
    [update],
  );

  const open = useMemo(() => (tasks ?? []).filter((t) => !t.done_at), [tasks]);
  const scheduled = open.filter((t) => t.start_min > 0);
  const shelf = open.filter((t) => t.start_min <= 0);
  // Tasks that overlap pack into lanes, so a clash reads as a clash rather
  // than as one block hidden under another.
  const lanes = useMemo(
    () =>
      layoutLanes(
        scheduled.map((t) => ({ id: t.id, start_min: t.start_min, dur_min: t.dur_min })),
      ),
    [scheduled],
  );

  // A vanished shelf item (checked off elsewhere, or placed) ends placing mode.
  useEffect(() => {
    if (placing && !shelf.some((t) => t.id === placing)) setPlacing(null);
  }, [placing, shelf]);

  // locationY is unreliable on react-native-web, so the tap is resolved
  // against the grid's window position instead.
  const tapGrid = (e: GestureResponderEvent) => {
    const pageY = e.nativeEvent.pageY;
    gridRef.current?.measureInWindow((_x, gridY) => {
      const min = clamp(snap(DAY_START + (pageY - gridY) / pxPerMin), DAY_START, DAY_END - SNAP);
      if (Number.isNaN(min)) return;
      if (placing) {
        update.mutate({ id: placing, patch: { start_min: min } });
        setPlacing(null);
      } else {
        onAddSlot(date, min);
      }
    });
  };

  return (
    <PageSheet
      date={date}
      count={open.length}
      height={height}
    >
      {error && (
        <View
          style={[
            styles.errorBox,
            { borderColor: alpha(colors.clay, 0.4), backgroundColor: alpha(colors.clay, 0.1) },
          ]}
        >
          <Text style={[styles.errorText, type.sans, { color: colors.ink }]}>
            Couldn’t load this day. {error.message}
          </Text>
        </View>
      )}
      {isPending && !error && (
        <View style={[styles.ghost, { backgroundColor: alpha(colors.ink, 0.04) }]} />
      )}

      {tasks && (
        <>
          {shelf.length > 0 && (
            <View style={styles.shelf}>
              <Eyebrow>on the shelf</Eyebrow>
              <View style={styles.shelfRow}>
                {shelf.map((t) => (
                  <ShelfChip
                    key={t.id}
                    task={t}
                    active={placing === t.id}
                    onPress={() => setPlacing((p) => (p === t.id ? null : t.id))}
                    pxPerMin={pxPerMin}
                    gridRef={gridRef}
                    onHover={showDrop}
                    onDrop={(min) => dropAt(t.id, min)}
                  />
                ))}
              </View>
              <Text style={[styles.shelfHint, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
                {placing
                  ? "Now tap an hour below to give it that time."
                  : "Hold a slip and drag it onto an hour — or tap it, then an hour."}
              </Text>
            </View>
          )}

          <View ref={gridRef} style={[styles.grid, { height: (DAY_END - DAY_START) * pxPerMin }]}>
            <HourGrid pxPerMin={pxPerMin} today={date === localDate()} />
            <DropLine pxPerMin={pxPerMin} hoverMin={hoverMin} />
            <Pressable
              accessibilityLabel="Add a task at this time"
              onPress={tapGrid}
              style={[styles.tapLayer, { left: GUTTER }]}
            />
            <View pointerEvents="box-none" style={[styles.blocks, { left: GUTTER }]}>
              {scheduled.map((t) => (
                <TimeBlock
                  key={t.id}
                  task={t}
                  pxPerMin={pxPerMin}
                  lane={lanes.get(t.id) ?? { lane: 0, lanes: 1 }}
                  onDone={() =>
                    update.mutate({ id: t.id, patch: { done_at: new Date().toISOString() } })
                  }
                  onSchedule={(start_min) => update.mutate({ id: t.id, patch: { start_min } })}
                  onResize={(dur_min) => update.mutate({ id: t.id, patch: { dur_min } })}
                  onUnschedule={() => update.mutate({ id: t.id, patch: { start_min: 0 } })}
                />
              ))}
            </View>
          </View>
          {scheduled.length === 0 && (
            <Text style={[styles.emptyHint, type.sans, { color: colors.inkMuted }]}>
              {shelf.length > 0
                ? "Tap an hour to add, or drag a slip down from the shelf."
                : "Tap any hour to box in a task."}
            </Text>
          )}
        </>
      )}
    </PageSheet>
  );
}

/** Where a dragged slip would land: one zest rule across the hour under the
 * finger. It lives on shared values, so following a drag costs no renders. */
function DropLine({
  pxPerMin,
  hoverMin,
}: {
  pxPerMin: number;
  hoverMin: SharedValue<number>;
}) {
  const colors = usePalette();
  const style = useAnimatedStyle(() => ({
    opacity: hoverMin.value < 0 ? 0 : 1,
    top: (hoverMin.value - DAY_START) * pxPerMin,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.tick, styles.dropLine, style]}>
      <View style={[styles.dropDot, { left: GUTTER - 4, backgroundColor: colors.zest }]} />
      <View
        style={{
          marginLeft: GUTTER + 4,
          borderTopWidth: 2,
          borderStyle: "dashed",
          borderTopColor: colors.zest,
        }}
      />
    </Animated.View>
  );
}

/** The ruled hours: printed labels in the margin, hairline rules across, a
 * zest "now" thread stitched through today. */
function HourGrid({ pxPerMin, today }: { pxPerMin: number; today: boolean }) {
  const colors = usePalette();
  const type = useType();
  const nowMin = useNowMinutes(today);
  // Finer rules appear as the hours grow tall enough to read them.
  const showHalf = pxPerMin >= 0.75;
  const showQuarter = pxPerMin >= 1.05;
  const ticks = Array.from(
    { length: (DAY_END - DAY_START) / SNAP + 1 },
    (_, i) => DAY_START + i * SNAP,
  );

  return (
    <>
      {ticks.map((m) => {
        const inHour = (m - DAY_START) % 60;
        const isHour = inHour === 0;
        const isHalf = inHour === 30;
        if (!isHour && !isHalf && !showQuarter) return null;
        if (isHalf && !showHalf) return null;
        return (
          <View key={m} pointerEvents="none" style={[styles.tick, { top: (m - DAY_START) * pxPerMin }]}>
            <Text
              style={[
                styles.tickLabel,
                type.sansMedium,
                isHour
                  ? { top: -5, fontSize: 9, color: alpha(colors.inkMuted, 0.7) }
                  : { top: -4, fontSize: 8, color: alpha(colors.inkMuted, 0.4) },
              ]}
            >
              {isHour ? fmtMin(m).toUpperCase() : `:${inHour}`}
            </Text>
            <View
              style={{
                marginLeft: GUTTER,
                borderTopWidth: 1,
                borderTopColor: alpha(colors.rule, isHour ? 0.6 : isHalf ? 0.35 : 0.2),
              }}
            />
          </View>
        );
      })}

      {nowMin != null && nowMin >= DAY_START && nowMin <= DAY_END && (
        <View pointerEvents="none" style={[styles.tick, styles.nowLine, { top: (nowMin - DAY_START) * pxPerMin }]}>
          <View style={[styles.nowDot, { left: GUTTER - 3, backgroundColor: colors.zest }]} />
          <View
            style={{
              marginLeft: GUTTER + 3,
              borderTopWidth: 2,
              borderTopColor: alpha(colors.zest, 0.7),
            }}
          />
        </View>
      )}
    </>
  );
}

/** One boxed task: a grained paper slip pinned to its slot. Hold it a beat to
 * lift, drag to a new slot (15-min snap) or up past the top to send it back
 * to the shelf; pull the bottom hem to restretch its length. */
function TimeBlock({
  task,
  pxPerMin,
  lane,
  onDone,
  onSchedule,
  onResize,
  onUnschedule,
}: {
  task: Task;
  pxPerMin: number;
  lane: { lane: number; lanes: number };
  onDone: () => void;
  onSchedule: (startMin: number) => void;
  onResize: (durMin: number) => void;
  onUnschedule: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const shadow = useShadow();
  const router = useRouter();
  const height = task.dur_min * pxPerMin;
  const compact = height < 46;

  const lifted = useSharedValue(false);
  const offSheet = useSharedValue(false);
  const offset = useSharedValue(0); // snapped px offset while dragging
  const liveH = useSharedValue(height);
  const resizing = useSharedValue(false);
  useEffect(() => {
    liveH.value = height;
  }, [height, liveH]);

  const start = task.start_min;
  const durMin = task.dur_min;

  const movePan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      lifted.value = true;
      runOnJS(hapticLift)();
    })
    .onUpdate((e) => {
      const raw = start + e.translationY / pxPerMin;
      offSheet.value = raw < DAY_START - 20;
      const snapped = Math.min(DAY_END - SNAP, Math.max(DAY_START, Math.round(raw / SNAP) * SNAP));
      offset.value = withSpring((snapped - start) * pxPerMin, { stiffness: 500, damping: 40 });
    })
    .onEnd((e) => {
      const raw = start + e.translationY / pxPerMin;
      if (raw < DAY_START - 20) {
        runOnJS(onUnschedule)();
      } else {
        const snapped = Math.min(DAY_END - SNAP, Math.max(DAY_START, Math.round(raw / SNAP) * SNAP));
        if (snapped !== start) runOnJS(onSchedule)(snapped);
      }
    })
    .onFinalize(() => {
      lifted.value = false;
      offSheet.value = false;
      offset.value = 0;
    });

  // A tight activation window so the hem wins the race against the page's
  // scroll — grabbing the hem must stretch the block, never scroll the day.
  const hemPan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart(() => {
      resizing.value = true;
    })
    .onUpdate((e) => {
      const rawDur = durMin + e.translationY / pxPerMin;
      const snapped = Math.min(DAY_END - start, Math.max(SNAP, Math.round(rawDur / SNAP) * SNAP));
      liveH.value = snapped * pxPerMin;
    })
    .onEnd(() => {
      const finalDur = Math.round(liveH.value / pxPerMin / SNAP) * SNAP;
      if (finalDur !== durMin) runOnJS(onResize)(finalDur);
    })
    .onFinalize(() => {
      resizing.value = false;
    });

  const blockStyle = useAnimatedStyle(() => ({
    height: liveH.value,
    opacity: offSheet.value ? 0.5 : 1,
    zIndex: lifted.value || resizing.value ? 30 : 1,
    shadowOpacity: (lifted.value ? 0.25 : 0.08) * shadow,
    elevation: Math.round((lifted.value ? 6 : 1) * shadow),
    transform: [
      { translateY: offset.value },
      { scale: withTiming(lifted.value ? 1.02 : 1, timing(dur.instant)) },
      { rotate: lifted.value ? "-0.4deg" : "0deg" },
    ],
  }));

  return (
    <GestureDetector gesture={movePan}>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        layout={settle()}
        style={[
          styles.block,
          blockStyle,
          {
            top: (start - DAY_START) * pxPerMin,
            left: `${(lane.lane / lane.lanes) * 100}%`,
            width: `${100 / lane.lanes}%`,
            backgroundColor: colors.surface,
            borderColor: alpha(colors.rule, 0.7),
            shadowColor: colors.ink,
          },
        ]}
      >
        <View style={[styles.blockAccent, { backgroundColor: alpha(colors.zest, 0.7) }]} />
        <Pressable
          onPress={() => router.push(`/task/${task.id}`)}
          style={[styles.blockBody, compact ? styles.blockBodyCompact : null]}
        >
          <Check done={false} label={`Mark "${task.title}" done`} size={18} onToggle={onDone} />
          <View style={styles.blockText}>
            <Text
              numberOfLines={1}
              style={[type.sansMedium, { fontSize: compact ? 12 : 13, color: colors.ink }]}
            >
              {task.title}
            </Text>
            {!compact && (
              <Text style={[styles.blockTime, type.sans, { color: colors.inkMuted }]}>
                {fmtMin(start)} – {fmtMin(start + durMin)}
              </Text>
            )}
          </View>
        </Pressable>
        {/* The hem: pinch and pull to restretch the slot. */}
        <GestureDetector gesture={hemPan}>
          <Animated.View style={styles.hem}>
            <View style={[styles.hemBar, { backgroundColor: alpha(colors.ink, 0.15) }]} />
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </GestureDetector>
  );
}

/** An unscheduled task waiting on the shelf.
 *
 * **Hold it and drag it onto an hour.** That is the direct way to say "this,
 * then" and it is what anyone who has used a calendar reaches for first; the
 * tap-then-tap path stays because it is the one that works when the hour you
 * want is off the bottom of the screen, and because a target you must hit with
 * a moving finger is a poor only option.
 *
 * The hold is what keeps the day scrollable: a pan that grabbed on contact
 * would eat every upward swipe that happened to start on a slip. Same 180ms
 * and the same lift as a block already on the grid, so a slip behaves like a
 * block before it has a time. */
function ShelfChip({
  task,
  active,
  onPress,
  pxPerMin,
  gridRef,
  onHover,
  onDrop,
}: {
  task: Task;
  active: boolean;
  onPress: () => void;
  pxPerMin: number;
  /** Measured mid-gesture, so the finger and the grid are read in one frame. */
  gridRef: AnimatedRef<View>;
  /** Worklet. The hour this slip is over, or -1 for none. */
  onHover: (min: number) => void;
  onDrop: (min: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const shadow = useShadow();
  const update = useUpdateTask();

  const lifted = useSharedValue(false);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  /** The finger's window Y as a snapped minute, or null when it is above the
   * grid — which is how a slip gets dropped back on the shelf unchanged. */
  const minAt = (absoluteY: number) => {
    "worklet";
    const box = measure(gridRef);
    if (!box) return null;
    const raw = DAY_START + (absoluteY - box.pageY) / pxPerMin;
    if (raw < DAY_START - 20) return null;
    return Math.min(DAY_END - SNAP, Math.max(DAY_START, Math.round(raw / SNAP) * SNAP));
  };

  const drag = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      lifted.value = true;
      runOnJS(hapticLift)();
    })
    .onUpdate((e) => {
      dx.value = e.translationX;
      dy.value = e.translationY;
      onHover(minAt(e.absoluteY) ?? -1);
    })
    .onEnd((e) => {
      const min = minAt(e.absoluteY);
      if (min != null) runOnJS(onDrop)(min);
    })
    .onFinalize(() => {
      lifted.value = false;
      // Springs home if it was dropped nowhere; if it landed, the slip leaves
      // the shelf anyway and this is never seen.
      dx.value = withSpring(0, HOME);
      dy.value = withSpring(0, HOME);
      onHover(-1);
    });

  const chipStyle = useAnimatedStyle(() => ({
    zIndex: lifted.value ? 40 : 0,
    shadowOpacity: (lifted.value ? 0.22 : 0) * shadow,
    elevation: lifted.value ? Math.round(6 * shadow) : 0,
    transform: [
      { translateX: dx.value },
      { translateY: dy.value },
      { scale: withTiming(lifted.value ? 1.06 : 1, timing(dur.instant)) },
      { rotate: lifted.value ? "-1.5deg" : "0deg" },
    ],
  }));

  return (
    <GestureDetector gesture={drag}>
    <Animated.View
      entering={FadeIn.duration(160)}
      exiting={FadeOut.duration(140)}
      layout={settle()}
      style={[chipStyle, styles.shelfChipLift, { shadowColor: colors.ink }]}
    >
      <Pressable
        onPress={onPress}
        accessibilityState={{ selected: active }}
        accessibilityHint="Hold and drag onto an hour, or tap and then tap an hour"
        style={[
          styles.shelfChip,
          {
            backgroundColor: colors.surface,
            borderColor: active ? colors.zest : alpha(colors.rule, 0.7),
            borderWidth: active ? 1.5 : 1,
          },
        ]}
      >
        <Check
          done={false}
          label={`Mark "${task.title}" done`}
          size={18}
          onToggle={() =>
            update.mutate({ id: task.id, patch: { done_at: new Date().toISOString() } })
          }
        />
        <Text
          numberOfLines={1}
          style={[styles.shelfChipText, type.sansMedium, { color: colors.ink }]}
        >
          {task.title}
        </Text>
      </Pressable>
    </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
  },
  ghost: {
    marginTop: 16,
    height: 160,
    borderRadius: 12,
  },
  shelf: {
    marginTop: 16,
  },
  shelfRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shelfChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
  },
  // The lifted slip needs a shadow to carry and has to sit above its
  // neighbours while it travels.
  shelfChipLift: {
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  shelfChipText: {
    maxWidth: 176,
    fontSize: 13,
  },
  shelfHint: {
    marginTop: 8,
    fontSize: 11,
  },
  grid: {
    marginTop: 20,
  },
  tapLayer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
  },
  blocks: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
  },
  tick: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  tickLabel: {
    position: "absolute",
    left: 0,
    width: 36,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  nowLine: {
    zIndex: 10,
  },
  nowDot: {
    position: "absolute",
    top: -3,
    height: 7,
    width: 7,
    borderRadius: 999,
  },
  // Above the blocks: the line says where the slip goes, so it has to be
  // readable over whatever is already sitting there.
  dropLine: {
    zIndex: 35,
  },
  dropDot: {
    position: "absolute",
    top: -4,
    height: 9,
    width: 9,
    borderRadius: 999,
  },
  block: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  blockAccent: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 999,
  },
  blockBody: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  blockBodyCompact: {
    alignItems: "center",
    paddingVertical: 2,
  },
  blockText: {
    flex: 1,
    minWidth: 0,
  },
  blockTime: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  hem: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  hemBar: {
    height: 3,
    width: 28,
    borderRadius: 999,
  },
  emptyHint: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 13,
  },
});
