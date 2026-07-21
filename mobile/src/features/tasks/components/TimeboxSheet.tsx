import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Check } from "@/components/Check";
import { Eyebrow } from "@/components/surface";
import { localDate } from "@/lib/dates";
import { hapticLift } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDayTasks, useUpdateTask } from "../api";
import { DAY_END, DAY_START, GUTTER, SNAP, clamp, fmtMin, layoutLanes, snap } from "../timeGrid";
import type { Task } from "../types";
import { PageSheet } from "./AgendaSheet";

const settle = LinearTransition.springify().stiffness(420).damping(32);

/** The day as a ruled sheet of hours. Blocks are paper slips pinned to their
 * slots; unscheduled work waits on a shelf above. Tap a shelf slip, then an
 * hour, to place it (the mobile stand-in for the web's drag) — or tap an empty
 * hour to box in a brand-new task. Long-press a slip for shelf/delete. */
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
  const gridRef = useRef<View>(null);

  const open = useMemo(() => (tasks ?? []).filter((t) => !t.done_at), [tasks]);
  const scheduled = open.filter((t) => t.start_min > 0);
  const shelf = open.filter((t) => t.start_min <= 0);
  const lanes = useMemo(
    () => layoutLanes(scheduled.map((t) => ({ id: t.id, start_min: t.start_min, dur_min: t.dur_min }))),
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
    <PageSheet date={date} count={open.length} height={height}>
      {error && (
        <View
          style={[
            styles.errorBox,
            { borderColor: alpha(colors.clay, 0.4), backgroundColor: alpha(colors.clay, 0.1) },
          ]}
        >
          <Text style={[styles.errorText, type.sans, { color: colors.ink }]}>
            Couldn't load this day. {error.message}
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
                  />
                ))}
              </View>
              <Text style={[styles.shelfHint, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
                {placing
                  ? "Now tap an hour below to give it that time."
                  : "Tap a slip, then an hour below, to give it a time."}
              </Text>
            </View>
          )}

          <View ref={gridRef} style={[styles.grid, { height: (DAY_END - DAY_START) * pxPerMin }]}>
            <HourGrid pxPerMin={pxPerMin} today={date === localDate()} />
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
                ? "Tap an hour to add, or place a slip from the shelf."
                : "Tap any hour to box in a task."}
            </Text>
          )}
        </>
      )}
    </PageSheet>
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

function useNowMinutes(enabled: boolean): number | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);
  return enabled ? now.getHours() * 60 + now.getMinutes() : null;
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
  const dur = task.dur_min;

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
      const rawDur = dur + e.translationY / pxPerMin;
      const snapped = Math.min(DAY_END - start, Math.max(SNAP, Math.round(rawDur / SNAP) * SNAP));
      liveH.value = snapped * pxPerMin;
    })
    .onEnd(() => {
      const finalDur = Math.round(liveH.value / pxPerMin / SNAP) * SNAP;
      if (finalDur !== dur) runOnJS(onResize)(finalDur);
    })
    .onFinalize(() => {
      resizing.value = false;
    });

  const blockStyle = useAnimatedStyle(() => ({
    height: liveH.value,
    opacity: offSheet.value ? 0.5 : 1,
    zIndex: lifted.value || resizing.value ? 30 : 1,
    shadowOpacity: lifted.value ? 0.25 : 0.08,
    elevation: lifted.value ? 6 : 1,
    transform: [
      { translateY: offset.value },
      { scale: withSpring(lifted.value ? 1.02 : 1, { stiffness: 420, damping: 32 }) },
      { rotate: lifted.value ? "-0.4deg" : "0deg" },
    ],
  }));

  return (
    <GestureDetector gesture={movePan}>
      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(140)}
        layout={settle}
        style={[
          styles.block,
          blockStyle,
          {
            top: (start - DAY_START) * pxPerMin,
            left: `${(lane.lane / lane.lanes) * 100}%`,
            width: `${100 / lane.lanes}%`,
            backgroundColor: colors.surface,
            borderColor: alpha(colors.rule, 0.7),
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
                {fmtMin(start)} – {fmtMin(start + dur)}
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

/** An unscheduled task waiting on the shelf — tap to arm it, then tap an hour. */
function ShelfChip({
  task,
  active,
  onPress,
}: {
  task: Task;
  active: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} layout={settle}>
      <Pressable
        onPress={onPress}
        accessibilityState={{ selected: active }}
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
  block: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#282018",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
