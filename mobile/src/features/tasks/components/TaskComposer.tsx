import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { CalendarClock, Plus, StickyNote, X } from "lucide-react-native";
import { createElement, useState } from "react";
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
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { StampEdge } from "@/components/stamp-edge";
import { Eyebrow } from "@/components/surface";
import { useShadow } from "@/features/style/store";
import { addDays, localDate, pad2, toLocalNoon, toPbDate } from "@/lib/dates";
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

/** The new-task button: a postage stamp pinned above the tab bar — a fresh
 * slip waiting to be stuck onto the day. On native it opens the system form
 * sheet (/compose); the web build slides up its own drawer. */
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
        <StampEdge color={colors.zest} />
        <Plus size={24} strokeWidth={2.6} color={colors.paper} />
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
  // Where the task lands: null = the viewed day's default; the chips and the
  // native picker override it.
  const [due, setDue] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const today = localDate();
  const effDate = due ?? date;
  const dayLabel = toLocalNoon(effDate).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Start moves the whole box; end just restretches it (never before start).
  const pickStart = (m: number) => {
    setStart(m);
    setEnd((e) => (e == null || e <= m ? Math.min(m + 60, 24 * 60) : e));
  };
  const pickEnd = (m: number) => {
    if (start != null) setEnd(Math.max(start + 15, m));
  };
  const applyPick = (d: Date) => {
    setDue(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    pickStart(minsOf(d));
  };
  // The picker starts from what's chosen, or the next round hour today.
  const pickValue = (() => {
    const v = toLocalNoon(effDate);
    if (start != null) v.setHours(Math.floor(start / 60), start % 60, 0, 0);
    else v.setHours(new Date().getHours() + 1, 0, 0, 0);
    return v;
  })();

  const pickDay = (d: string) => {
    hapticTap();
    setDue((cur) => (cur === d ? null : d));
  };
  const openClock = () => {
    hapticTap();
    const show = () => {
      if (Platform.OS === "android") {
        // Android has no combined picker — date dialog, then time dialog.
        DateTimePickerAndroid.open({
          value: pickValue,
          mode: "date",
          onChange: (e, day) => {
            if (e.type !== "set" || !day) return;
            DateTimePickerAndroid.open({
              value: day,
              mode: "time",
              onChange: (e2, when) => {
                if (e2.type === "set" && when) applyPick(when);
              },
            });
          },
        });
      } else {
        setShowPicker((s) => !s);
      }
    };
    // The keyboard must clear the stage first, or the system control lands
    // where the keyboard was and then jumps.
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      setTimeout(show, 300);
    } else {
      show();
    }
  };

  const submit = () => {
    if (!title.trim()) return;
    hapticSuccess();
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      // A timed task must belong to a day; otherwise the viewed day is the
      // default due date and plain "today" needs none.
      due_date:
        due != null
          ? toPbDate(due)
          : start != null
            ? toPbDate(date)
            : isToday
              ? undefined
              : toPbDate(date),
      start_min: start ?? 0,
      dur_min: start != null && end != null ? Math.max(15, end - start) : 60,
    });
    onDone();
  };

  return (
    <View style={fill && styles.fill}>
      <Eyebrow>new task{due != null || start != null || !isToday ? ` · ${dayLabel}` : ""}</Eyebrow>
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

      {start != null && end != null && (
        <View
          style={[
            styles.timedRow,
            { borderColor: alpha(colors.rule, 0.6), backgroundColor: alpha(colors.paper, 0.5) },
          ]}
        >
          <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>from</Text>
          <TimeControl value={start} onChange={pickStart} />
          <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>to</Text>
          <TimeControl value={end} onChange={pickEnd} />
          <View style={styles.timedSpacer} />
          <Pressable
            accessibilityLabel="Remove time"
            onPress={() => {
              setStart(null);
              setEnd(null);
            }}
            hitSlop={8}
          >
            <X size={14} color={alpha(colors.inkMuted, 0.6)} />
          </Pressable>
        </View>
      )}

      <View style={styles.chips}>
        {/* When it lands: today, tomorrow, or the native clock for anything else. */}
        <WhenChip
          label="today"
          active={effDate === today}
          tint={colors.zest}
          onPress={() => pickDay(today)}
        />
        <WhenChip
          label="tomorrow"
          active={effDate === addDays(today, 1)}
          tint={colors.zest}
          onPress={() => pickDay(addDays(today, 1))}
        />
        <PressableScale
          scaleTo={0.95}
          accessibilityLabel="Pick a date and time"
          accessibilityState={{ selected: showPicker }}
          onPress={openClock}
          style={[
            styles.chip,
            showPicker
              ? { borderColor: alpha(colors.sky, 0.5), backgroundColor: alpha(colors.sky, 0.1) }
              : { borderColor: colors.rule },
          ]}
        >
          <CalendarClock size={14} color={showPicker ? colors.ink : colors.inkMuted} />
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

      {/* The system's own date + time control — it knows its locale, its
          calendar, and its dark mode better than we do. */}
      {showPicker && Platform.OS === "ios" && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.pickerRow}>
          <DateTimePicker
            value={pickValue}
            mode="datetime"
            display="compact"
            minuteInterval={5}
            accentColor={colors.zest}
            onChange={(_e, d) => d && applyPick(d)}
          />
        </Animated.View>
      )}
      {showPicker && Platform.OS === "web" && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.pickerRow}>
          {createElement("input", {
            type: "datetime-local",
            defaultValue: `${effDate}T${hhmm(start ?? pickValue.getHours() * 60)}`,
            onChange: (e: { target: { value: string } }) => {
              const d = new Date(e.target.value);
              if (!Number.isNaN(d.getTime())) applyPick(d);
            },
            style: domInputStyle(colors.ink, alpha(colors.rule, 0.9)),
          })}
        </Animated.View>
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

/** A little scheduling key — zest-inked while it's the chosen day. */
function WhenChip({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.95}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { borderColor: alpha(tint, 0.5), backgroundColor: alpha(tint, 0.1) }
          : { borderColor: colors.rule },
      ]}
    >
      <Text style={[styles.chipText, type.sansMedium, { color: active ? tint : colors.inkMuted }]}>
        {label}
      </Text>
    </PressableScale>
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
  timedSpacer: {
    flex: 1,
  },
  timePill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chips: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
