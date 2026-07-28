import { Check as CheckIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { DAY_START, fmtMin } from "@/features/tasks/timeGrid";
import { settle } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import type { DayRitual } from "../api";
import { RITUAL_ICON, useRitualInk } from "../look";
import { useOpenSlot } from "../open";

/** A ritual pinned to its hour on the day sheet.
 *
 * Deliberately not a `TimeBlock`: a task's slot is yours to drag and restretch,
 * a ritual's comes from the schedule, so this one has no hem and no lift. If
 * six o'clock is wrong, the Rituals panel is where six o'clock is wrong. */
export function RitualBlock({
  slot,
  pxPerMin,
  lane,
}: {
  slot: DayRitual;
  pxPerMin: number;
  lane: { lane: number; lanes: number };
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useRitualInk()(slot);
  const open = useOpenSlot();

  const Icon = RITUAL_ICON[slot.ritual.kind];
  const kept = slot.state === "kept";
  const missed = slot.state === "missed";
  const height = slot.dur_min * pxPerMin;
  const compact = height < 42;
  const title = slot.ritual.label;

  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      layout={settle()}
      style={[
        styles.block,
        {
          top: (slot.start_min - DAY_START) * pxPerMin,
          height,
          left: `${(lane.lane / lane.lanes) * 100}%`,
          width: `${100 / lane.lanes}%`,
          backgroundColor: missed ? "transparent" : ink.field,
          borderColor: missed ? alpha(colors.rule, 0.9) : alpha(ink.solid, 0.35),
          borderStyle: missed ? "dashed" : "solid",
        },
        kept && styles.kept,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: alpha(ink.solid, missed ? 0.35 : 0.7) }]} />
      <Pressable
        accessibilityLabel={`${title}, ${fmtMin(slot.start_min)}, ${slot.note}`}
        onPress={() => open(slot)}
        style={[styles.body, compact && styles.bodyCompact]}
      >
        {kept ? (
          <CheckIcon size={14} color={ink.stamp} strokeWidth={3} />
        ) : (
          <Icon size={14} color={missed ? alpha(colors.inkMuted, 0.8) : ink.stamp} />
        )}
        <View style={styles.text}>
          <Text
            numberOfLines={1}
            style={[type.sansMedium, { fontSize: compact ? 12 : 13, color: colors.ink }]}
          >
            {title}
          </Text>
          {!compact && (
            <Text numberOfLines={1} style={[styles.note, type.sans, { color: colors.inkMuted }]}>
              {slot.note}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** The same slot at week scale, where there is room for a colour and a word.
 * Read-only: the week grid does not act, it shows the shape of the week. */
export function RitualPip({
  slot,
  pxPerMin,
  lane,
}: {
  slot: DayRitual;
  pxPerMin: number;
  lane: { lane: number; lanes: number };
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useRitualInk()(slot);
  const missed = slot.state === "missed";
  const height = slot.dur_min * pxPerMin;
  const title = slot.ritual.label;

  return (
    <View
      style={[
        styles.pip,
        {
          top: (slot.start_min - DAY_START) * pxPerMin,
          height,
          left: `${(lane.lane / lane.lanes) * 100}%`,
          width: `${100 / lane.lanes}%`,
          backgroundColor: missed ? "transparent" : alpha(ink.solid, 0.16),
          borderColor: alpha(missed ? colors.rule : ink.solid, missed ? 0.9 : 0.45),
          borderStyle: missed ? "dashed" : "solid",
        },
        slot.state === "kept" && styles.kept,
      ]}
    >
      {height >= 18 && (
        <Text numberOfLines={1} style={[styles.pipText, type.sansMedium, { color: colors.ink }]}>
          {title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  // Kept slots step back so the eye lands on what is still to come — the same
  // move the done pile makes on the list page.
  kept: { opacity: 0.66 },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingLeft: 10,
    paddingRight: 8,
  },
  bodyCompact: { alignItems: "center", paddingVertical: 0 },
  text: { flex: 1, minWidth: 0 },
  note: { marginTop: 1, fontSize: 10.5 },
  pip: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingTop: 1,
    overflow: "hidden",
  },
  pipText: { fontSize: 9 },
});
