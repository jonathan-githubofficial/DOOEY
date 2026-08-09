import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import {
  ArrowUp,
  CalendarArrowUp,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  Mic,
  Moon,
  Plus,
  Repeat,
  Sunrise,
  Tag,
} from "lucide-react-native";
import { createElement, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleSvg } from "@/components/DoodleSvg";
import { DrawerHead } from "@/components/drawer-head";
import { Grain } from "@/components/grain";
import { IconChip } from "@/components/icon-chip";
import { PressableScale } from "@/components/pressable-scale";
import { StampEdge } from "@/components/stamp-edge";
import { useShadow, useStyleStore } from "@/features/style/store";
import { addDays, dayTitle, localDate, pad2, toLocalNoon, toPbDate } from "@/lib/dates";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { DOCK_GAP, SHEET_OVERHANG, useDockTop } from "@/lib/shell";
import { appear, dur, timing } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { RambleSheet } from "@/features/rambler/components/RambleSheet";
import { useCreateTask } from "../api";
import { activeTagQuery, completeTag, harvestTags, openTag } from "../tags";
import { MonthView } from "./MonthView";
import { TagChips } from "./TagChips";
import { TagPicker } from "./TagPicker";
import { fmtMin } from "../timeGrid";

const minsOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const dateAtMin = (m: number) => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};
const hhmm = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const isWeekend = (date: string) => {
  const dow = toLocalNoon(date).getDay();
  return dow === 0 || dow === 6;
};

/** How a task recurs. Repeats are expanded into concrete task copies on save
 * (the model has no recurrence field), so each rule caps its horizon. */
type RepeatRule = "none" | "daily" | "weekdays" | "weekly";
const REPEATS: { key: RepeatRule; label: string }[] = [
  { key: "none", label: "Once" },
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Weekdays" },
  { key: "weekly", label: "Weekly" },
];
/** The four days worth a shortcut, each with the icon that says it faster
 * than the word does. "This evening" is the only one that also sets an hour —
 * naming it is naming a time. */
const QUICK: {
  label: string;
  Icon: typeof CalendarDays;
  day: (today: string) => string;
  min?: number;
}[] = [
  { label: "Today", Icon: CalendarDays, day: (t) => t },
  { label: "Tomorrow", Icon: Sunrise, day: (t) => addDays(t, 1) },
  {
    label: "Next Monday",
    Icon: CalendarArrowUp,
    // 1 = Monday. Landing on this coming Monday, or a week out if it's Monday.
    day: (t) => addDays(t, ((1 - toLocalNoon(t).getDay() + 7) % 7) || 7),
  },
  { label: "This evening", Icon: Moon, day: (t) => t, min: 18 * 60 },
];

/** Time-box lengths, in minutes — the four a task actually gets given. */
const LENGTHS = [15, 30, 60, 120];

const REPEAT_HORIZON: Record<RepeatRule, number> = { none: 0, daily: 14, weekdays: 14, weekly: 8 };

/** Expand a repeat rule from a base day into the concrete days to create. */
function expandRepeat(base: string, rule: RepeatRule): string[] {
  if (rule === "none") return [base];
  const out: string[] = [];
  for (let i = 0; out.length < REPEAT_HORIZON[rule] && i < 60; i++) {
    const day = addDays(base, i);
    if (rule === "weekdays" && isWeekend(day)) continue;
    if (rule === "weekly" && i % 7 !== 0) continue;
    out.push(day);
  }
  return out;
}

/** The one-line summary shown on the composer's "when" pill. */
function whenSummary(date: string, start: number | null, repeat: RepeatRule): string {
  const day = dayTitle(date);
  const time = start != null ? `, ${fmtMin(start)}` : "";
  const rep = repeat !== "none" ? ` · ${REPEATS.find((r) => r.key === repeat)!.label.toLowerCase()}` : "";
  return `${day}${time}${rep}`;
}

/** The new-task button: a postage stamp pinned above the tab bar — and the
 * companion's home. Once he's drawn in the Style studio he lives IN the stamp
 * (flipping through his poses), a small zest + pinned beside him.
 *
 * It opens the drawer, which is where both ways of saying something live: the
 * form, and the ramble one chip away from it. Rambling was briefly the whole
 * button, and that was wrong — talking is a way *into* the drawer, not a
 * replacement for it, and a form is still the fastest way to put one clear
 * thing on a specific day. */
export function TaskComposer({ date }: { date: string }) {
  const colors = usePalette();
  const shadow = useShadow();
  const dockTop = useDockTop();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isToday = date === localDate();
  const dayLabel = toLocalNoon(date).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const frames = useStyleStore((s) => s.companion);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (frames.length < 2) return;
    const t = setInterval(() => setFrame((f) => f + 1), 550);
    return () => clearInterval(t);
  }, [frames.length]);
  const companion = frames.length > 0 ? frames[frame % frames.length] : null;

  return (
    <>
      <PressableScale
        scaleTo={0.9}
        rotate={-4}
        accessibilityLabel={isToday ? "New task" : `New task for ${dayLabel}`}
        onPress={() => {
          hapticTap();
          if (Platform.OS === "web") setOpen(true);
          else router.push({ pathname: "/compose", params: { date } });
        }}
        style={[
          styles.stampFab,
          // One dock, one clearance: the stamp rides the same height above the
          // bar on every device instead of guessing at the web island's.
          { bottom: dockTop + DOCK_GAP },
          // A stamp's shadow has to follow its perforated edge. iOS traces the
          // layer's alpha; the web gets the same silhouette from a drop-shadow
          // filter, and must NOT also carry shadow* props — RNW turns those
          // into a box-shadow, a rectangle hanging behind the teeth.
          Platform.OS === "web"
            ? ({
                filter: "drop-shadow(0 1.5px 1.5px rgb(40 32 24 / 0.25))",
              } as unknown as ViewStyle)
            : [
                styles.fabShadow,
                { shadowOpacity: 0.25 * shadow, elevation: Math.round(4 * shadow) },
              ],
        ]}
      >
        {/* The stamp is always the accent (orange), grained like real paper. */}
        <StampEdge color={colors.zest} />
        <View style={styles.fabGrain} pointerEvents="none">
          <Grain radius={13} />
        </View>
        {companion ? (
          <>
            <View style={styles.fabCompanion}>
              <DoodleSvg strokes={companion} strokeWidth={3} />
            </View>
            {/* + rides in its own paper disc in the corner. */}
            <View style={[styles.fabPlusBadge, { backgroundColor: colors.paper }]}>
              <Plus size={12} strokeWidth={3} color={colors.zest} />
            </View>
          </>
        ) : (
          // No companion: the + sits centred in a contrasting paper disc.
          <View style={[styles.fabPlusDisc, { backgroundColor: colors.paper }]}>
            <Plus size={20} strokeWidth={2.8} color={colors.zest} />
          </View>
        )}
      </PressableScale>

      {open && <ComposerSheet date={date} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The web task drawer: slides up from the bottom edge and hosts the form.
 * Native never mounts this — /compose presents the same form as a real
 * system sheet, which handles the keyboard itself. */
export function ComposerSheet({
  date,
  initialStart,
  onClose,
}: {
  date: string;
  initialStart?: number;
  onClose: () => void;
}) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();

  // Drag the drawer down to put it away. The grabber promises this, and the
  // form has no cancel button on the strength of that promise.
  const drag = useSharedValue(0);
  const dismiss = Gesture.Pan()
    // Vertical only, and only downward past a deliberate distance, so it never
    // steals a tap on a field or the horizontal scroll of the tag picker.
    .activeOffsetY(14)
    .failOffsetY(-14)
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 900) runOnJS(onClose)();
      else drag.value = withTiming(0, timing(dur.quick));
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* A Modal is its own view tree, so gestures inside it need their own
          root — the same thing the doodle pad's modal does. */}
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
          <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetHost}
          pointerEvents="box-none"
        >
          <GestureDetector gesture={dismiss}>
            <Animated.View
              // Ease-out, no spring: the drawer travels the whole screen
              // height, so even a small overshoot reads as a wobble.
              entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
              exiting={SlideOutDown.duration(220)}
              style={[
                styles.sheet,
                dragStyle,
                {
                  backgroundColor: colors.surface,
                  borderColor: alpha(colors.rule, 0.7),
                  paddingBottom: Math.max(24, insets.bottom + 8) + SHEET_OVERHANG,
                  marginBottom: -SHEET_OVERHANG,
                },
              ]}
            >
              <Grain radius={23} />
              <View style={styles.handleRow}>
                <View style={[styles.handle, { backgroundColor: alpha(colors.ink, 0.15) }]} />
              </View>
              <ComposerForm date={date} initialStart={initialStart} onDone={onClose} />
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Everything you need to shape a task — title, details, notes, and (when
 * opened from a calendar slot) the time box. The host decides how it's
 * presented: native form sheet or web drawer.
 *
 * The Mic chip swaps the body for the ramble in place rather than navigating.
 * One drawer, two ways of filling it: the form when you know exactly what you
 * want on which day, the ramble when you would rather just say it. */
export function ComposerForm({
  date,
  initialStart,
  onDone,
}: {
  date: string;
  initialStart?: number;
  onDone: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const create = useCreateTask();
  const isToday = date === localDate();
  const [rambling, setRambling] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const titleRef = useRef<TextInput>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [start, setStart] = useState<number | null>(initialStart ?? null);
  const [end, setEnd] = useState<number | null>(initialStart != null ? initialStart + 60 : null);
  // Where the task lands: null = the viewed day's default. Editing "when"
  // pins a concrete date, a time box, and how it repeats.
  const [due, setDue] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatRule>("none");
  const [whenOpen, setWhenOpen] = useState(false);

  const effDate = due ?? date;

  const submit = () => {
    if (!title.trim()) return;
    hapticSuccess();
    // Sending is a way of closing the last tag too: someone who types
    // "gym session #gym" and hits send means the tag, and shouldn't have to
    // press space first to be understood.
    const { title: plain, tags: trailing } = harvestTags(`${title} `);
    const base = {
      title: plain.trim(),
      description: description.trim() || undefined,
      tags: [...tags, ...trailing.filter((t) => !tags.includes(t))],
      start_min: start ?? 0,
      dur_min: start != null && end != null ? Math.max(15, end - start) : 60,
    };
    if (repeat !== "none") {
      // Recurrence has no model field — lay down one task per occurrence.
      for (const day of expandRepeat(effDate, repeat)) {
        create.mutate({ ...base, due_date: toPbDate(day) });
      }
    } else {
      create.mutate({
        ...base,
        // A timed task must belong to a day; otherwise the viewed day is the
        // default due date and a plain undated "today" needs none.
        due_date:
          due != null
            ? toPbDate(due)
            : start != null
              ? toPbDate(date)
              : isToday
                ? undefined
                : toPbDate(date),
      });
    }
    onDone();
  };

  const openWhen = () => {
    hapticTap();
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      setTimeout(() => setWhenOpen(true), 250);
    } else {
      setWhenOpen(true);
    }
  };

  const ready = !!title.trim() && !create.isPending;
  // Non-null exactly while a tag is being typed at the end of the title.
  const tagQuery = activeTagQuery(title);

  /** Every keystroke: a tag closed by a space leaves the text and becomes a
   * chip. The title in state is therefore always the plain sentence, which is
   * what gets stored and what every other screen shows. */
  const type_ = (next: string) => {
    const { title: plain, tags: found } = harvestTags(next);
    setTitle(plain);
    if (found.length > 0) setTags((cur) => [...cur, ...found.filter((t) => !cur.includes(t))]);
  };

  // Non-empty title: the corner stops offering to listen and starts offering
  // to file.
  const typing = !!title.trim();

  return (
    <View>
      <TextInput
        ref={titleRef}
        autoFocus
        value={title}
        onChangeText={type_}
        onSubmitEditing={submit}
        placeholder="What needs doing?"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        returnKeyType="done"
        style={[styles.titleInput, type.display, { color: colors.ink }]}
      />
      {/* The tags this task has already collected, and — while one is being
          typed — the list to finish it from. */}
      <TagChips
        tags={tags}
        onRemove={(t) => setTags((cur) => cur.filter((x) => x !== t))}
        style={styles.tagRow}
      />

      {tagQuery !== null && (
        <TagPicker
          query={tagQuery}
          taken={tags}
          onPick={(t) => type_(completeTag(title, t))}
        />
      )}

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Details (optional)"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        multiline
        style={[styles.detailsInput, type.sans, { color: colors.ink }]}
      />

      {/* One square per thing a task can carry, each opening its own field
          below. A row meant to grow: the next one slots in beside the tag. */}
      <View style={styles.chips}>
        {/* The "when" key is the wide one — it reads the current plan back to
            you, so it needs words where the others need only an icon. */}
        <PressableScale
          scaleTo={0.96}
          accessibilityLabel="When"
          onPress={openWhen}
          style={[
            styles.whenPill,
            { borderColor: alpha(colors.sky, 0.4), backgroundColor: alpha(colors.sky, 0.08) },
          ]}
        >
          <CalendarClock size={14} color={colors.sky} />
          <Text
            numberOfLines={1}
            style={[styles.whenText, type.sansMedium, { color: colors.ink }]}
          >
            {whenSummary(effDate, start, repeat)}
          </Text>
          <ChevronRight size={13} color={alpha(colors.inkMuted, 0.6)} />
        </PressableScale>
        {/* Not a field of its own: it drops a `#` where you are already
            typing and hands the caret back. The tag is part of the sentence,
            and the title lights it up wherever the task is shown. */}
        <IconChip
          Icon={Tag}
          label="Add a tag"
          tint={colors.sky}
          active={tags.length > 0}
          onPress={() => {
            hapticTap();
            setTitle(openTag(title));
            titleRef.current?.focus();
          }}
        />
        <View style={styles.chipSpacer} />

        {/* The corner is *the action*, and what the action is depends on what
            you have done. Empty, the fastest way to say something is out loud,
            so the corner is the mic. The moment there is a title the corner is
            the thing that files it. One filled square either way: the drawer
            never has two accents shouting at each other, and the corner never
            sits empty waiting for you to earn it. */}
        <Animated.View key={typing ? "send" : "talk"} entering={appear()}>
          <PressableScale
            scaleTo={0.88}
            accessibilityLabel={typing ? "Add task" : "Say it instead"}
            accessibilityState={{ disabled: typing && !ready }}
            disabled={typing && !ready}
            onPress={() => {
              if (typing) {
                submit();
                return;
              }
              hapticTap();
              Keyboard.dismiss();
              setRambling(true);
            }}
            style={[
              styles.iconChip,
              { backgroundColor: colors.zest, borderColor: colors.zest },
              typing && !ready && styles.addDiscOff,
            ]}
          >
            {typing ? (
              <ArrowUp size={17} color={colors.paper} strokeWidth={2.8} />
            ) : (
              <Mic size={16} color={colors.paper} strokeWidth={2.6} />
            )}
          </PressableScale>
        </Animated.View>
      </View>

      <RambleSheet
        visible={rambling}
        onClose={() => setRambling(false)}
        onFiled={() => {
          setRambling(false);
          onDone();
        }}
      />

      {whenOpen && (
        <WhenSheet
          date={date}
          initial={{ due, start, end, repeat }}
          onClose={() => setWhenOpen(false)}
          onConfirm={(next) => {
            setDue(next.due);
            setStart(next.start);
            setEnd(next.end);
            setRepeat(next.repeat);
            setWhenOpen(false);
          }}
        />
      )}

    </View>
  );
}

/** One end of the time box, in the platform's own control: the compact iOS
 * time pill, Android's time dialog behind a chip, a plain time input on web. */
function TimeControl({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const colors = usePalette();
  const type = useType();
  if (Platform.OS === "ios") {
    return (
      <DateTimePicker
        value={dateAtMin(value)}
        mode="time"
        display="compact"
        minuteInterval={5}
        accentColor={colors.zest}
        onChange={(_e, d) => d && onChange(minsOf(d))}
      />
    );
  }
  if (Platform.OS === "web") {
    return createElement("input", {
      type: "time",
      value: hhmm(value),
      onChange: (e: { target: { value: string } }) => {
        const [h, m] = e.target.value.split(":").map(Number);
        if (!Number.isNaN(h)) onChange(h * 60 + (m || 0));
      },
      style: domInputStyle(colors.ink, alpha(colors.rule, 0.9)),
    });
  }
  return (
    <Pressable
      accessibilityLabel="Pick a time"
      onPress={() =>
        DateTimePickerAndroid.open({
          value: dateAtMin(value),
          mode: "time",
          onChange: (e, d) => {
            if (e.type === "set" && d) onChange(minsOf(d));
          },
        })
      }
      style={[
        styles.timePill,
        { borderColor: alpha(colors.rule, 0.8), backgroundColor: colors.surface },
      ]}
    >
      <Text style={[styles.timedStart, type.sansMedium, { color: colors.ink }]}>
        {fmtMin(value)}
      </Text>
    </Pressable>
  );
}

/** Inline styles for the web's raw DOM inputs — RNW styles don't reach them. */
const domInputStyle = (color: string, borderColor: string) => ({
  fontFamily: "inherit",
  fontSize: 13,
  color,
  background: "transparent",
  border: `1px solid ${borderColor}`,
  borderRadius: 8,
  padding: "3px 8px",
});

interface WhenValue {
  due: string | null;
  start: number | null;
  end: number | null;
  repeat: RepeatRule;
}

/** The scheduling drawer: quick days, a calendar, a from–to time box, and how
 * it repeats — Cancel top-left, Confirm top-right. Slides up over the
 * composer; edits a draft and only commits on Confirm. */
function WhenSheet({
  date,
  initial,
  onConfirm,
  onClose,
}: {
  date: string;
  initial: WhenValue;
  onConfirm: (v: WhenValue) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();

  const [day, setDay] = useState(initial.due ?? date);
  const [start, setStart] = useState<number | null>(initial.start);
  const [end, setEnd] = useState<number | null>(initial.end);
  const [repeat, setRepeat] = useState<RepeatRule>(initial.repeat);
  const [tab, setTab] = useState<"date" | "duration">("date");
  const [month, setMonth] = useState(() => (initial.due ?? date).slice(0, 7));
  const [repeatOpen, setRepeatOpen] = useState(false);

  const today = localDate();

  /** Move the day and carry the calendar with it, so a shortcut into next
   * month doesn't leave the grid behind on this one. */
  const pickDay = (d: string) => {
    setDay(d);
    setMonth(d.slice(0, 7));
  };

  const pickStart = (m: number) => {
    setStart(m);
    setEnd((e) => (e == null || e <= m ? Math.min(m + 60, 24 * 60) : e));
  };
  const pickEnd = (m: number) => setEnd(Math.max((start ?? 0) + 15, m));
  const toggleTimed = () => {
    hapticTap();
    if (start != null) {
      setStart(null);
      setEnd(null);
    } else {
      pickStart(Math.min((new Date().getHours() + 1) * 60, 23 * 60));
    }
  };

  const confirm = () => {
    hapticTap();
    // Leave the day unpinned when it still matches the planner's day, so plain
    // "today" tasks keep their undated semantics.
    onConfirm({ due: day === date ? null : day, start, end, repeat });
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={styles.backdrop}>
        <Pressable accessibilityLabel="Cancel" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={styles.sheetHost} pointerEvents="box-none">
        <Animated.View
          entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220)}
          style={[
            styles.whenSheet,
            {
              backgroundColor: colors.surface,
              borderColor: alpha(colors.rule, 0.7),
              paddingBottom: Math.max(24, insets.bottom + 8) + SHEET_OVERHANG,
              marginBottom: -SHEET_OVERHANG,
            },
          ]}
        >
          <Grain radius={23} />
          <DrawerHead
            onCancel={onClose}
            onConfirm={confirm}
            confirmLabel="Confirm when"
            style={styles.whenHead}
            center={
              <View style={[styles.tabWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
                {(["date", "duration"] as const).map((t) => {
                  const on = tab === t;
                  return (
                    <PressableScale
                      key={t}
                      scaleTo={0.94}
                      accessibilityLabel={t === "date" ? "Pick a date" : "Pick a duration"}
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        hapticTap();
                        setTab(t);
                      }}
                      style={[
                        styles.tabKey,
                        on && {
                          backgroundColor: colors.surface,
                          borderColor: alpha(colors.rule, 0.7),
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          type.sansMedium,
                          { color: on ? colors.ink : colors.inkMuted },
                        ]}
                      >
                        {t === "date" ? "Date" : "Duration"}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            }
          />

          {tab === "date" ? (
            <Animated.View entering={FadeIn.duration(dur.quick)}>
              {/* Four ways of naming a day without counting squares. "This
                  evening" sets an hour as well: it is the one shortcut whose
                  whole meaning is the time. */}
              <View style={styles.quickRow}>
                {QUICK.map((q) => {
                  const at = q.day(today);
                  const on = day === at && (q.min == null || start === q.min);
                  return (
                    <PressableScale
                      key={q.label}
                      scaleTo={0.94}
                      accessibilityLabel={q.label}
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        hapticTap();
                        pickDay(at);
                        if (q.min != null) pickStart(q.min);
                      }}
                      style={styles.quickKey}
                    >
                      <View
                        style={[
                          styles.quickDisc,
                          {
                            backgroundColor: on
                              ? alpha(colors.zest, 0.16)
                              : alpha(colors.ink, 0.05),
                          },
                        ]}
                      >
                        <q.Icon size={17} color={on ? colors.zest : colors.inkMuted} />
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.quickLabel,
                          type.sansMedium,
                          { color: on ? colors.ink : colors.inkMuted },
                        ]}
                      >
                        {q.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              {/* The real calendar, always open. It used to hide behind a
                  "pick a day" chip, so the common case — some date later this
                  month — cost a tap to reveal a control that was needed
                  anyway. Its dots come free with it, and they say which days
                  are already full before you drop another task on one. */}
              <MonthView month={month} onMonth={setMonth} selected={day} onSelect={pickDay} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(dur.quick)} style={styles.durationPane}>
              {start == null ? (
                <>
                  <Text style={[styles.allDay, type.sans, { color: colors.inkMuted }]}>
                    All day — no particular hour.
                  </Text>
                  <PressableScale
                    scaleTo={0.96}
                    accessibilityLabel="Give it a time"
                    onPress={toggleTimed}
                    style={[styles.addTime, { borderColor: alpha(colors.rule, 0.9) }]}
                  >
                    <Clock size={14} color={colors.inkMuted} />
                    <Text style={[styles.addTimeText, type.sansMedium, { color: colors.inkMuted }]}>
                      Give it a time
                    </Text>
                  </PressableScale>
                </>
              ) : (
                <>
                  <View
                    style={[
                      styles.timedRow,
                      {
                        borderColor: alpha(colors.rule, 0.6),
                        backgroundColor: alpha(colors.paper, 0.5),
                      },
                    ]}
                  >
                    <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>
                      from
                    </Text>
                    <TimeControl value={start} onChange={pickStart} />
                    <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>to</Text>
                    <TimeControl value={end ?? start + 60} onChange={pickEnd} />
                  </View>
                  <View style={styles.lengthRow}>
                    {LENGTHS.map((n) => {
                      const on = end != null && end - start === n;
                      return (
                        <PressableScale
                          key={n}
                          scaleTo={0.94}
                          accessibilityLabel={`${n} minutes long`}
                          accessibilityState={{ selected: on }}
                          onPress={() => {
                            hapticTap();
                            setEnd(Math.min(start + n, 24 * 60));
                          }}
                          style={[
                            styles.chip,
                            on
                              ? {
                                  borderColor: alpha(colors.zest, 0.5),
                                  backgroundColor: alpha(colors.zest, 0.12),
                                }
                              : { borderColor: colors.rule },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              type.sansMedium,
                              { color: on ? colors.zest : colors.inkMuted },
                            ]}
                          >
                            {n < 60 ? `${n}m` : `${n / 60}h`}
                          </Text>
                        </PressableScale>
                      );
                    })}
                    <PressableScale
                      scaleTo={0.94}
                      accessibilityLabel="Make it all day"
                      onPress={toggleTimed}
                      style={[styles.chip, { borderColor: colors.rule }]}
                    >
                      <Text style={[styles.chipText, type.sansMedium, { color: colors.inkMuted }]}>
                        all day
                      </Text>
                    </PressableScale>
                  </View>
                </>
              )}
            </Animated.View>
          )}

          {/* One settled row per remaining decision, its answer on the right.
              Repeat is the only one so far: a reminder row would need
              notifications, which this app doesn't have, and a row that does
              nothing is worse than no row. */}
          <View style={[styles.rowList, { borderTopColor: alpha(colors.rule, 0.6) }]}>
            <PressableScale
              scaleTo={0.99}
              accessibilityLabel="Repeat"
              accessibilityState={{ expanded: repeatOpen }}
              onPress={() => {
                hapticTap();
                setRepeatOpen((o) => !o);
              }}
              style={styles.settingRow}
            >
              <Repeat size={15} color={colors.inkMuted} />
              <Text style={[styles.settingLabel, type.sans, { color: colors.ink }]}>Repeat</Text>
              <Text style={[styles.settingValue, type.sansMedium, { color: colors.inkMuted }]}>
                {REPEATS.find((r) => r.key === repeat)!.label}
              </Text>
              <ChevronRight size={15} color={alpha(colors.inkMuted, 0.6)} />
            </PressableScale>
            {repeatOpen && (
              <Animated.View
                entering={FadeIn.duration(dur.quick)}
                style={[styles.repeatWell, { backgroundColor: alpha(colors.ink, 0.05) }]}
              >
                {REPEATS.map((r) => {
                  const active = repeat === r.key;
                  return (
                    <PressableScale
                      key={r.key}
                      scaleTo={0.94}
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        hapticTap();
                        setRepeat(r.key);
                      }}
                      style={[
                        styles.repeatKey,
                        active && {
                          backgroundColor: colors.surface,
                          borderColor: alpha(colors.rule, 0.7),
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.repeatText,
                          type.sansMedium,
                          { color: active ? colors.ink : colors.inkMuted },
                        ]}
                      >
                        {r.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The -4° tilt lives on PressableScale's `rotate`, not here — a transform
  // in this style would be clobbered by the press-scale animation.
  stampFab: {
    position: "absolute",
    right: 16,
    zIndex: 30,
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  fabShadow: {
    shadowColor: "#282018",
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // The grain is inset a hair so it never bleeds into the perforations.
  fabGrain: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: 13,
    overflow: "hidden",
    opacity: 0.7,
  },
  fabCompanion: {
    height: 38,
    width: 38,
  },
  fabPlusDisc: {
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    shadowColor: "#282018",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  fabPlusBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    height: 18,
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    shadowColor: "#282018",
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  fill: { flex: 1 },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20, 16, 12, 0.25)",
  },
  sheetHost: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  handleRow: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handle: {
    height: 4,
    width: 40,
    borderRadius: 999,
  },
  iconChip: {
    height: 34,
    width: 34,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tagRow: { marginTop: 10 },
  /** Shoves the send button to the far end of the icon row. */
  chipSpacer: { flex: 1 },
  addDiscOff: { opacity: 0.35 },
  titleInput: {
    marginTop: 2,
    fontSize: 20,
    letterSpacing: -0.4,
    paddingVertical: 4,
  },
  detailsInput: {
    marginTop: 4,
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 2,
  },
  timedRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  timedStart: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  timedFor: {
    fontSize: 12,
  },
  timePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chips: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  whenPill: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
  },
  whenText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 13,
  },
  whenSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  whenHead: {
    marginBottom: 14,
  },
  tabWell: { flexDirection: "row", borderRadius: 999, padding: 3, gap: 2 },
  tabKey: { height: 28, justifyContent: "center", paddingHorizontal: 14, borderRadius: 999 },
  tabText: { fontSize: 12 },
  quickRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  quickKey: { flex: 1, alignItems: "center", gap: 6 },
  quickDisc: {
    height: 42,
    width: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontSize: 10.5, textAlign: "center" },
  durationPane: { gap: 12, paddingVertical: 4 },
  allDay: { fontSize: 13.5 },
  addTime: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  addTimeText: { fontSize: 12.5 },
  lengthRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rowList: { marginTop: 16, borderTopWidth: 1, paddingTop: 4 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13 },
  settingLabel: { flex: 1, minWidth: 0, fontSize: 14.5 },
  settingValue: { fontSize: 13 },
  repeatWell: {
    marginTop: 10,
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  repeatKey: {
    flex: 1,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 999,
  },
  repeatText: {
    fontSize: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
  },
});
