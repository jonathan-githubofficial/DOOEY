import { useRouter } from "expo-router";
import { Pencil, Send, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Check } from "@/components/Check";
import { DoodleEditor } from "@/components/DoodleEditor";
import { DoodleSvg } from "@/components/DoodleSvg";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { useStyleStore } from "@/features/style/store";
import { addDays, dayTitle, dueInfo, localDate, toLocalNoon, toPbDate } from "@/lib/dates";
import { hapticLift, hapticSuccess, hapticTap, hapticWarn } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { useGardenStore } from "@/stores/garden";
import { usePalette, useType } from "@/stores/theme";
import { useDayTasks, useDeleteTask, useUpdateTask } from "../api";
import type { Task } from "../types";
import { BINDING_INSET, RING_COUNT } from "./PlannerBook";

const settle = LinearTransition.springify().stiffness(420).damping(32);
const ROW_H = 56;
const CHECK_LINE_H = 26; // one checklist line tucked under the title
const REVEAL_W = 72; // how far a row swipes left to bare its delete
const FLY_T = 96; // rightward pull past this and the row flies to tomorrow
const FLY_X = 400; // how far off the page the paper plane sails
const DAY_MS = 86_400_000;
const LIFT = { stiffness: 420, damping: 34 };

/** A row grows with its checklist — heights come from data, so the drag math
 * and the layout can never disagree. */
const rowHeight = (t: Task) =>
  ROW_H + (t.checklist.length ? t.checklist.length * CHECK_LINE_H + 8 : 0);

/** One planner page: the day's open tasks in a hold-to-drag reorderable list,
 * and the day's done pile. Rows open the task's page. */
export function AgendaSheet({ date, height }: { date: string; height?: number }) {
  const colors = usePalette();
  const type = useType();
  const { data: tasks, isPending, error } = useDayTasks(date);

  const open = useMemo(() => (tasks ?? []).filter((t) => !t.done_at), [tasks]);
  const done = (tasks ?? []).filter((t) => t.done_at);
  // A day with work behind it and nothing left: it earns the stamp,
  // the signature line, and the companion's little jump.
  const complete = !!tasks && open.length === 0 && done.length > 0;

  const body = (
    <>
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
      {isPending && !error && <GhostLines />}

      {tasks && (
        <>
          <ReorderableRows rows={open} date={date} />

          {open.length === 0 && done.length === 0 && (
            <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
              Nothing planned — the day is yours.
            </Text>
          )}

          {complete && <DoneStamp date={date} />}

          {done.length > 0 && (
            <Animated.View layout={settle} style={styles.donePile}>
              <Eyebrow>done</Eyebrow>
              {done.map((t) => (
                <DoneTaskRow key={t.id} task={t} />
              ))}
            </Animated.View>
          )}

          {complete && <SignDay date={date} />}
        </>
      )}
    </>
  );

  return (
    <PageSheet
      date={date}
      count={open.length}
      height={height}
      overlay={<Companion celebrate={complete} />}
    >
      {body}
    </PageSheet>
  );
}

// Days already celebrated this session — the stamp only thunks once per day.
const celebrated = new Set<string>();

/** The reward: a rubber stamp slammed onto a finished day. */
function DoneStamp({ date }: { date: string }) {
  const colors = usePalette();
  const type = useType();
  const scale = useSharedValue(1.9);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 520, damping: 26 });
    opacity.value = withTiming(0.9, { duration: 140 });
    if (!celebrated.has(date)) {
      celebrated.add(date);
      hapticSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: "-9deg" }, { scale: scale.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.doneStamp, { borderColor: colors.leaf }, style]}>
      <Text style={[styles.doneStampText, type.displayBlack, { color: colors.leaf }]}>DONE</Text>
    </Animated.View>
  );
}

/** Sign the finished day with a little drawing — it joins the garden on the
 * Account page. Tap an existing signature to redraw it. */
function SignDay({ date }: { date: string }) {
  const colors = usePalette();
  const type = useType();
  const strokes = useGardenStore((s) => s.signatures[date]);
  const sign = useGardenStore((s) => s.sign);
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.signRow}>
      {strokes?.length ? (
        <Pressable
          accessibilityLabel="Redraw the day's signature"
          onPress={() => setOpen(true)}
          style={styles.signature}
        >
          <DoodleSvg strokes={strokes} strokeWidth={3} />
        </Pressable>
      ) : (
        <PressableScale
          scaleTo={0.95}
          accessibilityLabel="Sign the day"
          onPress={() => {
            hapticTap();
            setOpen(true);
          }}
          style={[styles.signKey, { borderColor: alpha(colors.rule, 0.9) }]}
        >
          <Pencil size={13} color={alpha(colors.inkMuted, 0.7)} />
          <Text style={[styles.signKeyText, type.sansMedium, { color: colors.inkMuted }]}>
            sign the day
          </Text>
        </PressableScale>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <GestureHandlerRootView style={styles.signRoot}>
          <Pressable style={styles.signBackdrop} onPress={() => setOpen(false)}>
            <Pressable onPress={() => {}}>
              <DoodleEditor
                heading={`sign ${dayTitle(date).toLowerCase()}`}
                initial={strokes ?? []}
                onClose={() => setOpen(false)}
                onSave={(next) => {
                  sign(date, next);
                  hapticSuccess();
                  setOpen(false);
                }}
              />
            </Pressable>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

/** The margin companion: the little creature you doodled in the Style studio,
 * peeking over the page's bottom corner. It bobs while you work and hops when
 * the day is done. */
function Companion({ celebrate }: { celebrate: boolean }) {
  const strokes = useStyleStore((s) => s.pageDoodles.companion);
  const bob = useSharedValue(0);
  const hop = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [bob]);
  useEffect(() => {
    if (celebrate) {
      hop.value = withSequence(
        withTiming(-12, { duration: 150, easing: Easing.out(Easing.quad) }),
        withSpring(0, { stiffness: 320, damping: 11 }),
      );
    }
  }, [celebrate, hop]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value * 3 + hop.value }, { rotate: "5deg" }],
  }));
  if (!strokes?.length) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.companion, style]}>
      <DoodleSvg strokes={strokes} strokeWidth={2.8} />
    </Animated.View>
  );
}

/** The planner page itself, shared by every day view: the punched paper sheet
 * with its heading pinned at the top and the content scrolling INSIDE it. */
export function PageSheet({
  date,
  count,
  height,
  overlay,
  children,
}: {
  date: string;
  count: number;
  height?: number;
  /** Pinned over the paper (doesn't scroll) — stamps, companions. */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <View>
      <Panel style={[styles.sheet, height != null && { height }]}>
        <SheetHeading date={date} count={count} />
        {height != null ? (
          // Pinned page: the heading stays inked at the top, the day's
          // content scrolls inside the paper. The scroller spans the panel's
          // full width so rows bleeding past the padding aren't clipped.
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </Panel>

      {/* Punched holes — drawn on an unbordered wrapper (not inside the Panel,
          whose 1px border would nudge the percentage box inward) so they use
          the exact same width as the binder rings and line up dead-center. */}
      <View pointerEvents="none" style={styles.holesRow}>
        {Array.from({ length: RING_COUNT }).map((_, i) => (
          <View key={i} style={styles.holeSlot}>
            {/* Punched wells, lit from above — the web's ink/25 → ink/10 fade. */}
            <LinearGradient
              colors={[alpha(colors.ink, 0.25), alpha(colors.ink, 0.1)]}
              style={styles.hole}
            />
          </View>
        ))}
      </View>

      {overlay}
    </View>
  );
}

/** The sheet's date line: the day in display type, the actual date inked on as
 * a small rubber stamp, and the open count in a pressed counter chip. */
export function SheetHeading({ date, count }: { date: string; count: number }) {
  const colors = usePalette();
  const type = useType();
  const isToday = date === localDate();
  const stampText = toLocalNoon(date).toLocaleDateString("en", { month: "short", day: "numeric" });
  return (
    <View style={styles.heading}>
      <View style={styles.headingLeft}>
        <Text numberOfLines={1} style={[styles.headingTitle, type.display, { color: colors.ink }]}>
          {dayTitle(date)}
        </Text>
        <Stamp rotate={-4} color={isToday ? colors.zest : alpha(colors.inkMuted, 0.8)}>
          {stampText}
        </Stamp>
      </View>
      {count > 0 && (
        <View style={[styles.counter, { backgroundColor: alpha(colors.ink, 0.05) }]}>
          <Text style={[styles.counterText, type.sans, { color: colors.inkMuted }]}>
            {count} to do
          </Text>
        </View>
      )}
    </View>
  );
}

/** Hold a row a beat to lift it, then drag — the others part on springs. On
 * drop the new slot persists as a midpoint sort (dense reindex on collision),
 * exactly like the web planner. Rows are as tall as their checklists. */
function ReorderableRows({ rows, date }: { rows: Task[]; date: string }) {
  const update = useUpdateTask();
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(rows.map((r, i) => [r.id, i])),
  );
  const heightsObj = useMemo(
    () => Object.fromEntries(rows.map((r) => [r.id, rowHeight(r)])),
    [rows],
  );
  const heights = useSharedValue<Record<string, number>>(heightsObj);
  // Which row is baring its delete — swiping (or lifting) one closes the rest.
  const revealed = useSharedValue<string | null>(null);

  // Re-sync slots whenever the server list changes (adds, deletes, check-offs).
  const signature = rows.map((r) => r.id).join("|");
  useEffect(() => {
    positions.value = Object.fromEntries(rows.map((r, i) => [r.id, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => {
    heights.value = heightsObj;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heightsObj]);

  const commit = (id: string) => {
    const order = [...rows].sort(
      (a, b) => (positions.value[a.id] ?? 0) - (positions.value[b.id] ?? 0),
    );
    const idx = order.findIndex((r) => r.id === id);
    const prev = order[idx - 1]?.sort_order;
    const next = order[idx + 1]?.sort_order;
    if (prev == null && next == null) return;
    const target = prev == null ? next! - DAY_MS : next == null ? prev + DAY_MS : (prev + next) / 2;
    const collided =
      !Number.isFinite(target) || (prev != null && target <= prev) || (next != null && target >= next);
    if (collided) {
      order.forEach((r, i) => update.mutate({ id: r.id, patch: { sort_order: (i + 1) * DAY_MS } }));
    } else {
      update.mutate({ id, patch: { sort_order: target } });
    }
  };

  const listHeight = rows.reduce((sum, r) => sum + rowHeight(r), 0);

  return (
    <View style={[styles.list, { height: listHeight }]}>
      {rows.map((t, i) => (
        <DraggableRow
          key={t.id}
          task={t}
          index={i}
          count={rows.length}
          date={date}
          positions={positions}
          heights={heights}
          revealed={revealed}
          onDrop={commit}
        />
      ))}
    </View>
  );
}

function DraggableRow({
  task,
  index,
  count,
  date,
  positions,
  heights,
  revealed,
  onDrop,
}: {
  task: Task;
  index: number;
  count: number;
  date: string;
  positions: SharedValue<Record<string, number>>;
  heights: SharedValue<Record<string, number>>;
  revealed: SharedValue<string | null>;
  onDrop: (id: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const id = task.id;
  const h = rowHeight(task);
  const web = Platform.OS === "web";
  const [hovered, setHovered] = useState(false);

  const dragging = useSharedValue(false);
  const y = useSharedValue(0);
  const startY = useSharedValue(0);
  // Signed swipe: negative bares the delete on the right; positive pulls the
  // row toward its paper-plane flight to tomorrow.
  const shift = useSharedValue(0);
  const shiftStart = useSharedValue(0);
  // On the web the click fires AFTER the drag releases — swallow it, or every
  // drop also opens the task's page.
  const justDragged = useRef(false);
  const endDrag = () => {
    onDrop(id);
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 250);
  };
  const sendTomorrow = () => {
    hapticSuccess();
    update.mutate({ id, patch: { due_date: toPbDate(addDays(localDate(), 1)) } });
  };

  const lift = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      dragging.value = true;
      revealed.value = null;
      runOnJS(hapticLift)();
      let top = 0;
      const idx = positions.value[id] ?? index;
      for (const k in positions.value) {
        if (k !== id && positions.value[k] < idx) top += heights.value[k] ?? ROW_H;
      }
      startY.value = top;
      y.value = top;
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      // Which slot does the dragged row's centre fall into, heights and all?
      const centerY = y.value + (heights.value[id] ?? ROW_H) / 2;
      const others = Object.entries(positions.value)
        .filter(([k]) => k !== id)
        .sort((a, b) => a[1] - b[1]);
      let acc = 0;
      let newIdx = others.length;
      for (let i = 0; i < others.length; i++) {
        const hh = heights.value[others[i][0]] ?? ROW_H;
        if (centerY < acc + hh / 2) {
          newIdx = i;
          break;
        }
        acc += hh;
      }
      if (newIdx !== positions.value[id]) {
        const next: Record<string, number> = { [id]: newIdx };
        others.forEach(([k], i) => {
          next[k] = i >= newIdx ? i + 1 : i;
        });
        positions.value = next;
      }
    })
    // onEnd, not onFinalize: only a drag that actually lifted commits an
    // order — a plain tap must not touch sort_order at all.
    .onEnd(() => {
      runOnJS(endDrag)();
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  // Swipe LEFT to bare the delete on the right, iOS-style; pull RIGHT past
  // the threshold and the row folds off as a paper plane, landing on
  // tomorrow's page. (Native only — the web shows the hover trash instead.)
  // Horizontal-only: vertical drift fails it so scroll and lift keep working.
  const swipe = Gesture.Pan()
    .enabled(!web)
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onStart(() => {
      shiftStart.value = shift.value;
      revealed.value = id;
    })
    .onUpdate((e) => {
      shift.value = Math.max(-REVEAL_W, Math.min(FLY_T * 1.35, shiftStart.value + e.translationX));
    })
    .onEnd(() => {
      if (shift.value > FLY_T) {
        // Off it sails — commit once it has left the page.
        shift.value = withTiming(FLY_X, { duration: 340, easing: Easing.in(Easing.quad) }, (f) => {
          if (f) runOnJS(sendTomorrow)();
        });
        revealed.value = null;
      } else if (shift.value < -REVEAL_W / 2) {
        shift.value = withSpring(-REVEAL_W, LIFT);
        runOnJS(hapticTap)();
      } else {
        shift.value = withSpring(0, LIFT);
        revealed.value = null;
      }
    });

  // Another row swiping (or this one lifting) tucks this delete back in.
  useAnimatedReaction(
    () => revealed.value,
    (open) => {
      if (open !== id && shift.value < 0) shift.value = withSpring(0, LIFT);
    },
  );

  const closeReveal = () => {
    revealed.value = null;
    shift.value = withSpring(0, LIFT);
  };

  // The row is bare paper until it's lifted — only a live drag earns the
  // card treatment (surface fill, shadow, slight grow), like the web.
  const surface = colors.surface;
  const rule = alpha(colors.rule, 0.5);
  const rowStyle = useAnimatedStyle(() => {
    const idx = positions.value[id] ?? index;
    let top = 0;
    for (const k in positions.value) {
      if (k !== id && positions.value[k] < idx) top += heights.value[k] ?? ROW_H;
    }
    return dragging.value
      ? {
          top: y.value,
          zIndex: 20,
          backgroundColor: surface,
          shadowOpacity: 0.18,
          elevation: 6,
          transform: [{ scale: 1.02 }],
          borderTopColor: "transparent",
        }
      : {
          top: withSpring(top, LIFT),
          zIndex: 0,
          backgroundColor: "transparent",
          shadowOpacity: 0,
          elevation: 0,
          transform: [{ scale: withSpring(1, LIFT) }],
          // The hairline rides the row (web: border-t, first:border-t-0) so
          // it parts with the rows instead of floating between slots.
          borderTopColor: idx === 0 ? "transparent" : rule,
        };
  });
  // The card banks and fades as it flies; plain slide for the delete reveal.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shift.value },
      { rotate: shift.value > 0 ? `${(-shift.value / FLY_X) * 14}deg` : "0deg" },
    ],
    opacity: shift.value > FLY_T ? Math.max(0, 1 - (shift.value - FLY_T) / (FLY_X * 0.7 - FLY_T)) : 1,
  }));
  const underStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -shift.value) / REVEAL_W),
  }));
  const planeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, shift.value) / FLY_T),
    transform: [{ scale: 0.8 + 0.3 * Math.min(1, Math.max(0, shift.value) / FLY_T) }],
  }));

  const due = date === localDate() && task.due_date ? dueInfo(task.due_date) : null;
  const toggleItem = (itemId: string) =>
    update.mutate({
      id,
      patch: {
        checklist: task.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
      },
    });

  return (
    <GestureDetector gesture={Gesture.Race(swipe, lift)}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        style={[styles.row, { height: h }, rowStyle, { shadowColor: "#282018" }]}
      >
        <View style={styles.rowClip}>
          {!web && (
            <Animated.View style={[styles.deleteUnder, underStyle]}>
              <Pressable
                accessibilityLabel={`Delete "${task.title}"`}
                onPress={() => {
                  hapticWarn();
                  del.mutate(id);
                }}
                style={[styles.deleteBtn, { backgroundColor: alpha(colors.clay, 0.14) }]}
              >
                <Trash2 size={16} color={colors.clay} />
              </Pressable>
            </Animated.View>
          )}
          {!web && (
            <Animated.View pointerEvents="none" style={[styles.planeUnder, planeStyle]}>
              <View style={[styles.deleteBtn, { backgroundColor: alpha(colors.zest, 0.14) }]}>
                <Send size={16} color={colors.zest} />
              </View>
              <Text style={[styles.planeLabel, type.sansMedium, { color: colors.zest }]}>
                tomorrow
              </Text>
            </Animated.View>
          )}
          <Animated.View style={[styles.rowCard, cardStyle]}>
            {/* The WHOLE row opens the task's page; the check, the checklist
                lines and the trash are nested pressables, so they win their
                own taps. Holding anywhere lifts the row for a drag — the
                pressed wash tells your finger the row heard it. */}
            <Pressable
              style={({ pressed }) => [
                styles.rowPress,
                pressed && { backgroundColor: alpha(colors.ink, 0.04), borderRadius: 14 },
                web && ({ cursor: "grab" } as unknown as ViewStyle),
              ]}
              onPress={() => {
                if (justDragged.current) return;
                if (!web && shift.value !== 0) closeReveal();
                else router.push(`/task/${id}`);
              }}
              onHoverIn={web ? () => setHovered(true) : undefined}
              onHoverOut={web ? () => setHovered(false) : undefined}
            >
              <View style={styles.rowCheck}>
                <Check
                  done={false}
                  gate={task.gate}
                  label={`Mark "${task.title}" done`}
                  size={22}
                  onToggle={() =>
                    update.mutate({ id, patch: { done_at: new Date().toISOString() } })
                  }
                />
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowMain}>
                  <View style={styles.rowTitleLine}>
                    {task.gate && <Text style={{ color: colors.zest }}>⛳</Text>}
                    <Text
                      numberOfLines={1}
                      style={[styles.rowTitle, type.sans, { color: colors.ink }]}
                    >
                      {task.title}
                    </Text>
                    {due && due.tone !== "future" && <DueChip due={due} />}
                  </View>
                  {!!task.description && (
                    <Text
                      numberOfLines={1}
                      style={[styles.rowSub, type.sans, { color: colors.inkMuted }]}
                    >
                      {task.description}
                    </Text>
                  )}
                </View>
                {task.checklist.length > 0 && (
                  <View style={styles.rowChecklist}>
                    {task.checklist.map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityLabel={item.label}
                        onPress={() => toggleItem(item.id)}
                        style={styles.rowCheckLine}
                      >
                        <Check
                          done={item.done}
                          label={item.label}
                          size={16}
                          onToggle={() => toggleItem(item.id)}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.rowCheckLabel,
                            type.sans,
                            { color: item.done ? colors.inkMuted : colors.ink },
                            item.done && { textDecorationLine: "line-through" },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              {web && (
                <Pressable
                  accessibilityLabel={`Delete "${task.title}"`}
                  hitSlop={10}
                  onPress={() => del.mutate(id)}
                  style={[styles.rowTrash, { opacity: hovered ? 1 : 0 }]}
                >
                  <Trash2 size={14} color={alpha(colors.inkMuted, 0.5)} />
                </Pressable>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function DoneTaskRow({ task }: { task: Task }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const update = useUpdateTask();
  return (
    <Animated.View
      layout={settle}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
    >
      <Pressable style={styles.doneRow} onPress={() => router.push(`/task/${task.id}`)}>
        <Check
          done
          label={`Mark "${task.title}" not done`}
          size={22}
          onToggle={() => update.mutate({ id: task.id, patch: { done_at: "" } })}
        />
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, styles.rowDone, type.sans, { color: colors.inkMuted }]}
        >
          {task.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function DueChip({ due }: { due: { text: string; tone: string } }) {
  const colors = usePalette();
  const type = useType();
  const overdue = due.tone === "overdue";
  const tint = overdue ? colors.clay : colors.zest;
  return (
    <View
      style={[styles.dueChip, { borderColor: alpha(tint, 0.4), backgroundColor: alpha(tint, 0.1) }]}
    >
      <Text style={[styles.dueChipText, type.sansMedium, { color: tint }]}>{due.text}</Text>
    </View>
  );
}

/** Three softly pulsing placeholder lines while the day loads. */
function GhostLines() {
  const colors = usePalette();
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.ghosts}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[styles.ghost, pulseStyle, { backgroundColor: alpha(colors.ink, 0.04) }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    padding: 20,
    paddingTop: 36,
  },
  sheetScroll: {
    flex: 1,
    marginHorizontal: -20,
    marginBottom: -20,
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  holesRow: {
    position: "absolute",
    left: BINDING_INSET,
    right: BINDING_INSET,
    top: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  holeSlot: {
    width: 12,
    alignItems: "center",
  },
  hole: {
    height: 10,
    width: 10,
    borderRadius: 999,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headingLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headingTitle: {
    fontSize: 24,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  counter: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  list: {
    marginTop: 4,
  },
  row: {
    position: "absolute",
    left: -8,
    right: -8,
    borderRadius: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  rowClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: "hidden",
  },
  rowCard: {
    flex: 1,
    borderRadius: 14,
  },
  deleteUnder: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_W,
    alignItems: "center",
    justifyContent: "center",
  },
  planeUnder: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: FLY_T,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  planeLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  doneStamp: {
    alignSelf: "center",
    marginTop: 18,
    marginBottom: 6,
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  doneStampText: {
    fontSize: 26,
    letterSpacing: 6,
  },
  signRow: {
    marginTop: 18,
    alignItems: "center",
  },
  signature: {
    height: 76,
    width: 76,
    transform: [{ rotate: "-3deg" }],
  },
  signKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  signKeyText: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  signRoot: {
    flex: 1,
  },
  signBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 16, 12, 0.35)",
  },
  companion: {
    position: "absolute",
    right: 16,
    bottom: -10,
    height: 46,
    width: 46,
    zIndex: 5,
  },
  deleteBtn: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  rowPress: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingLeft: 12,
    paddingRight: 4,
  },
  rowCheck: {
    height: ROW_H,
    justifyContent: "center",
  },
  rowTrash: {
    height: ROW_H,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowMain: {
    height: ROW_H,
    justifyContent: "center",
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 15,
  },
  rowDone: {
    textDecorationLine: "line-through",
  },
  rowSub: {
    marginTop: 2,
    fontSize: 12,
  },
  rowChecklist: {
    paddingBottom: 8,
  },
  rowCheckLine: {
    height: CHECK_LINE_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },
  rowCheckLabel: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
  },
  dueChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dueChipText: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  empty: {
    marginTop: 12,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  donePile: {
    marginTop: 20,
  },
  errorBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
  },
  ghosts: {
    marginTop: 12,
    gap: 8,
  },
  ghost: {
    height: 36,
    borderRadius: 12,
  },
});
