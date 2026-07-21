import { Plus, StickyNote, X } from "lucide-react-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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
import { Eyebrow } from "@/components/surface";
import { useShadow } from "@/features/style/store";
import { localDate, toLocalNoon, toPbDate } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useCreateTask } from "../api";
import { fmtMin } from "../timeGrid";

const DURATIONS = [
  { min: 15, label: "15m" },
  { min: 30, label: "30m" },
  { min: 45, label: "45m" },
  { min: 60, label: "1h" },
  { min: 90, label: "1h 30" },
  { min: 120, label: "2h" },
  { min: 180, label: "3h" },
];

/** The new-task button: a postage stamp pinned above the dock — a fresh slip
 * waiting to be stuck onto the day. Tapping it slides the task drawer up from
 * the bottom edge. */
export function TaskComposer({ date }: { date: string }) {
  const colors = usePalette();
  const shadow = useShadow();
  const insets = useSafeAreaInsets();
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
        accessibilityLabel={isToday ? "New task" : `New task for ${dayLabel}`}
        onPress={() => setOpen(true)}
        style={[
          styles.stampFab,
          {
            bottom: Math.max(16, insets.bottom) + 64,
            backgroundColor: colors.zest,
            borderColor: alpha(colors.paper, 0.7),
            shadowOpacity: 0.25 * shadow,
            elevation: Math.round(4 * shadow),
          },
        ]}
      >
        <Grain radius={9} />
        <Plus size={24} strokeWidth={2.6} color={colors.paper} />
      </PressableScale>

      {open && <ComposerSheet date={date} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The task drawer: slides up from the bottom edge with everything you need to
 * shape a task — title, details, notes, and (when opened from a calendar slot)
 * the time box. */
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
  const type = useType();
  const insets = useSafeAreaInsets();
  const create = useCreateTask();
  const isToday = date === localDate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [start, setStart] = useState<number | null>(initialStart ?? null);
  const [dur, setDur] = useState(60);

  const dayLabel = toLocalNoon(date).toLocaleDateString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const submit = () => {
    if (!title.trim()) return;
    create.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      // A timed task must belong to a day; otherwise the viewed day is the
      // default due date and plain "today" needs none.
      due_date: start != null ? toPbDate(date) : isToday ? undefined : toPbDate(date),
      start_min: start ?? 0,
      dur_min: dur,
    });
    onClose();
  };

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

          <Eyebrow>new task{start != null || !isToday ? ` · ${dayLabel}` : ""}</Eyebrow>
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

          {start != null && (
            <View
              style={[
                styles.timedRow,
                { borderColor: alpha(colors.rule, 0.6), backgroundColor: alpha(colors.paper, 0.5) },
              ]}
            >
              <Text style={[styles.timedStart, type.sansMedium, { color: colors.ink }]}>
                {fmtMin(start)}
              </Text>
              <Text style={[styles.timedFor, type.sans, { color: colors.inkMuted }]}>for</Text>
              <View style={styles.durations}>
                {DURATIONS.map((d) => (
                  <Pressable
                    key={d.min}
                    onPress={() => setDur(d.min)}
                    style={[styles.durChip, dur === d.min && { backgroundColor: colors.zest }]}
                  >
                    <Text
                      style={[
                        styles.durChipText,
                        type.sansMedium,
                        { color: dur === d.min ? colors.paper : colors.inkMuted },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable accessibilityLabel="Remove time" onPress={() => setStart(null)} hitSlop={8}>
                <X size={14} color={alpha(colors.inkMuted, 0.6)} />
              </Pressable>
            </View>
          )}

          <View style={styles.chips}>
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

          <View style={styles.footer}>
            <Pressable onPress={onClose} hitSlop={8}>
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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stampFab: {
    position: "absolute",
    right: 16,
    zIndex: 30,
    height: 56,
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
    transform: [{ rotate: "-4deg" }],
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
  durations: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  durChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  durChipText: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  chips: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
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
