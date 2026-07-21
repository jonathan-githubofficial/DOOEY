import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { CalendarClock, Check, ChevronRight, Plus, Repeat, StickyNote } from "lucide-react-native";
import { createElement, useEffect, useState } from "react";
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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleSvg } from "@/components/DoodleSvg";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { StampEdge } from "@/components/stamp-edge";
import { Eyebrow } from "@/components/surface";
import { useShadow, useStyleStore } from "@/features/style/store";
import { addDays, dayTitle, localDate, pad2, toLocalNoon, toPbDate } from "@/lib/dates";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useCreateTask } from "../api";
import { fmtMin } from "../timeGrid";

const minsOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const dateAtMin = (m: number) => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};
const hhmm = (m: number) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
 * companion's home. Once he's drawn in the Style studio he lives IN the
 * stamp (flipping through his poses), a small zest + pinned beside him. On
 * native it opens the system form sheet (/compose); the web build slides up
 * its own drawer. */
export function TaskComposer({ date }: { date: string }) {
  const colors = usePalette();
  const shadow = useShadow();
  const insets = useSafeAreaInsets();
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
          {
            bottom: Math.max(16, insets.bottom) + 64,
            shadowOpacity: 0.25 * shadow,
            elevation: Math.round(4 * shadow),
          },
          // Web: shadow the stamp's perforated silhouette, like .stamp-btn.
          Platform.OS === "web" &&
            ({ filter: "drop-shadow(0 1.5px 1.5px rgb(40 32 24 / 0.25))" } as unknown as ViewStyle),
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

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.sheetHost}
        pointerEvents="box-none"
      >
        <Animated.View
          // Ease-out, no spring: the drawer travels the whole screen height,
          // so even a small overshoot reads as a wobble, not a settle.
          entering={SlideInDown.duration(300).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220)}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: alpha(colors.rule, 0.7),
              paddingBottom: Math.max(24, insets.bottom + 8),
            },
          ]}
        >
          <Grain radius={23} />
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: alpha(colors.ink, 0.15) }]} />
          </View>
          <ComposerForm date={date} initialStart={initialStart} onDone={onClose} />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Everything you need to shape a task — title, details, notes, and (when
 * opened from a calendar slot) the time box. The host decides how it's
 * presented: native form sheet or web drawer. */
export function ComposerForm({
  date,
  initialStart,
  fill,
  onDone,
}: {
  date: string;
  initialStart?: number;
  /** Stretch to the host's height and anchor the footer at the bottom. */
  fill?: boolean;
  onDone: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const create = useCreateTask();
  const isToday = date === localDate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
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
    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
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

  return (
    <View style={fill && styles.fill}>
      <Eyebrow>new task</Eyebrow>
      <TextInput
        autoFocus
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="What needs doing?"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        returnKeyType="done"
        style={[styles.titleInput, type.display, { color: colors.ink }]}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Details (optional)"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        multiline
        style={[styles.detailsInput, type.sans, { color: colors.ink }]}
      />

      <View style={styles.chips}>
        {/* One "when" key: it reads the current plan and opens the drawer. */}
        <PressableScale
          scaleTo={0.96}
          accessibilityLabel="When"
          onPress={openWhen}
          style={[styles.whenPill, { borderColor: alpha(colors.sky, 0.4), backgroundColor: alpha(colors.sky, 0.08) }]}
        >
          <CalendarClock size={14} color={colors.sky} />
          <Text style={[styles.whenText, type.sansMedium, { color: colors.ink }]}>
            {whenSummary(effDate, start, repeat)}
          </Text>
          <ChevronRight size={13} color={alpha(colors.inkMuted, 0.6)} />
        </PressableScale>
        <PressableScale
          scaleTo={0.95}
          accessibilityState={{ selected: showNotes }}
          onPress={() => setShowNotes((s) => !s)}
          style={[
            styles.chip,
            showNotes
              ? { borderColor: alpha(colors.honey, 0.5), backgroundColor: alpha(colors.honey, 0.1) }
              : { borderColor: colors.rule },
          ]}
        >
          <StickyNote size={14} color={showNotes ? colors.ink : colors.inkMuted} />
          <Text style={[styles.chipText, type.sansMedium, { color: showNotes ? colors.ink : colors.inkMuted }]}>
            notes
          </Text>
        </PressableScale>
      </View>

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

      {showNotes && (
        <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.springify().stiffness(400).damping(34)}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes for the task's page…"
            placeholderTextColor={alpha(colors.inkMuted, 0.5)}
            multiline
            style={[
              styles.notesInput,
              type.sans,
              {
                color: colors.ink,
                borderColor: alpha(colors.rule, 0.6),
                backgroundColor: alpha(colors.paper, 0.6),
              },
            ]}
          />
        </Animated.View>
      )}

      {fill && <View style={styles.fill} />}

      <View style={styles.footer}>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={[styles.cancel, type.sansMedium, { color: colors.inkMuted }]}>Cancel</Text>
        </Pressable>
        <PressableScale
          scaleTo={0.94}
          onPress={submit}
          disabled={!title.trim() || create.isPending}
          style={[
            styles.addBtn,
            { backgroundColor: colors.zest },
            (!title.trim() || create.isPending) && { opacity: 0.4 },
          ]}
        >
          <Text style={[styles.addBtnText, type.sansSemiBold, { color: colors.paper }]}>
            Add task
          </Text>
        </PressableScale>
      </View>
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
  const [showCal, setShowCal] = useState(false);

  const today = localDate();
  const comingSaturday = (() => {
    const dow = toLocalNoon(today).getDay();
    return addDays(today, (6 - dow + 7) % 7 || 7);
  })();
  const quick = [
    { label: "Today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "This weekend", date: comingSaturday },
    { label: "Next week", date: addDays(today, 7) },
  ];

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
              paddingBottom: Math.max(24, insets.bottom + 8),
            },
          ]}
        >
          <Grain radius={23} />
          <View style={styles.whenHead}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[styles.whenCancel, type.sansMedium, { color: colors.inkMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <Text style={[styles.whenTitle, type.display, { color: colors.ink }]}>When</Text>
            <PressableScale
              scaleTo={0.9}
              accessibilityLabel="Confirm"
              onPress={confirm}
              style={[styles.whenDone, { backgroundColor: colors.zest }]}
            >
              <Check size={16} strokeWidth={3} color={colors.paper} />
            </PressableScale>
          </View>

          <Eyebrow style={styles.whenEyebrow}>day</Eyebrow>
          <View style={styles.whenQuick}>
            {quick.map((q) => {
              const active = day === q.date;
              return (
                <PressableScale
                  key={q.label}
                  scaleTo={0.95}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticTap();
                    setDay(q.date);
                    setShowCal(false);
                  }}
                  style={[
                    styles.chip,
                    active
                      ? { borderColor: alpha(colors.zest, 0.5), backgroundColor: alpha(colors.zest, 0.12) }
                      : { borderColor: colors.rule },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      type.sansMedium,
                      { color: active ? colors.zest : colors.inkMuted },
                    ]}
                  >
                    {q.label}
                  </Text>
                </PressableScale>
              );
            })}
            <PressableScale
              scaleTo={0.95}
              accessibilityLabel="Pick a specific day"
              accessibilityState={{ selected: showCal || !quick.some((q) => q.date === day) }}
              onPress={() => {
                hapticTap();
                if (Platform.OS === "android") {
                  DateTimePickerAndroid.open({
                    value: toLocalNoon(day),
                    mode: "date",
                    onChange: (e, d) => {
                      if (e.type === "set" && d) setDay(ymd(d));
                    },
                  });
                } else {
                  setShowCal((s) => !s);
                }
              }}
              style={[
                styles.chip,
                !quick.some((q) => q.date === day)
                  ? { borderColor: alpha(colors.zest, 0.5), backgroundColor: alpha(colors.zest, 0.12) }
                  : { borderColor: colors.rule },
              ]}
            >
              <CalendarClock size={14} color={colors.inkMuted} />
              <Text style={[styles.chipText, type.sansMedium, { color: colors.inkMuted }]}>
                {quick.some((q) => q.date === day)
                  ? "Pick a day"
                  : toLocalNoon(day).toLocaleDateString("en", { month: "short", day: "numeric" })}
              </Text>
            </PressableScale>
          </View>
          {showCal && Platform.OS === "ios" && (
            <Animated.View entering={FadeIn.duration(160)} style={styles.pickerRow}>
              <DateTimePicker
                value={toLocalNoon(day)}
                mode="date"
                display="inline"
                accentColor={colors.zest}
                onChange={(_e, d) => d && setDay(ymd(d))}
              />
            </Animated.View>
          )}
          {showCal && Platform.OS === "web" && (
            <View style={styles.pickerRow}>
              {createElement("input", {
                type: "date",
                value: day,
                onChange: (e: { target: { value: string } }) => {
                  if (e.target.value) setDay(e.target.value);
                },
                style: domInputStyle(colors.ink, alpha(colors.rule, 0.9)),
              })}
            </View>
          )}

          <View style={styles.whenSectionHead}>
            <Eyebrow>time</Eyebrow>
            <Pressable onPress={toggleTimed} hitSlop={6}>
              <Text style={[styles.whenToggle, type.sansMedium, { color: colors.sky }]}>
                {start != null ? "all day" : "add a time"}
              </Text>
            </Pressable>
          </View>
          {start != null && end != null && (
            <Animated.View
              entering={FadeIn.duration(160)}
              style={[
                styles.timedRow,
                { borderColor: alpha(colors.rule, 0.6), backgroundColor: alpha(colors.paper, 0.5) },
              ]}
            >
              <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>from</Text>
              <TimeControl value={start} onChange={pickStart} />
              <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>to</Text>
              <TimeControl value={end} onChange={pickEnd} />
            </Animated.View>
          )}

          <Eyebrow style={styles.whenEyebrow}>repeat</Eyebrow>
          <View style={[styles.repeatWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
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
                  {r.key !== "none" && (
                    <Repeat size={12} color={active ? colors.ink : colors.inkMuted} />
                  )}
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
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
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
  titleInput: {
    marginTop: 8,
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
    flexWrap: "wrap",
    gap: 8,
  },
  whenPill: {
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  whenCancel: {
    fontSize: 13,
    width: 60,
  },
  whenTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  whenDone: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  whenEyebrow: {
    marginTop: 16,
  },
  whenQuick: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  whenSectionHead: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  whenToggle: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
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
  pickerRow: {
    marginTop: 10,
    flexDirection: "row",
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
  notesInput: {
    marginTop: 10,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  footer: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancel: {
    fontSize: 12,
    padding: 8,
  },
  addBtn: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  addBtnText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
