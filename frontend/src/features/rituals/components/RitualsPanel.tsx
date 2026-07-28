import { Plus, Trash2 } from "lucide-react-native";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { Stepper } from "@/components/stepper";
import { Eyebrow, Panel } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { fmtMin } from "@/features/tasks/timeGrid";
import { useRoutines } from "@/features/workouts/api";
import { hueOf } from "@/features/workouts/focus";
import { useCardInk } from "@/features/workouts/hues";
import type { Routine } from "@/features/workouts/types";
import { confirmDestructive } from "@/lib/confirm";
import { hapticTap } from "@/lib/haptics";
import { settle } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { RITUAL_ICON } from "../look";
import {
  DAY_MINUTES,
  TIME_STEP,
  WEEK,
  addTime,
  describeSchedule,
  removeTime,
  setTime,
  toggleDay,
} from "../schedule";
import { useRitualStore } from "../store";
import type { Ritual } from "../types";

/** Where the planner's shape gets decided: which weekdays a thing comes back
 * on, and at what times.
 *
 * A ritual is only ever a schedule. Nothing here records whether you kept it —
 * the workout and the journal entry are the record, and the planner reads them
 * back. That is why there is no "mark done" anywhere on this page. */
export function RitualsPanel() {
  const colors = usePalette();
  const type = useType();
  const rituals = useRitualStore((s) => s.rituals);
  const add = useRitualStore((s) => s.add);

  return (
    <>
      <View style={styles.banner}>
        <View style={[styles.bannerIcon, { backgroundColor: alpha(colors.leaf, 0.15) }]}>
          <RITUAL_ICON.gym size={20} color={colors.leaf} />
        </View>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, type.display, { color: colors.ink }]}>Rituals</Text>
          <Text style={[styles.bannerSub, type.sans, { color: colors.inkMuted }]}>
            What comes back every week. These lay themselves out on the planner.
          </Text>
        </View>
      </View>

      {rituals.map((ritual) => (
        <RitualEditor key={ritual.id} ritual={ritual} />
      ))}

      <View style={styles.addRow}>
        <AddButton label="Training" onPress={() => add("gym")} />
        <AddButton label="Meals" onPress={() => add("journal")} />
      </View>
    </>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = usePalette();
  const type = useType();
  const radius = useCardRadius();
  return (
    <PressableScale
      scaleTo={0.97}
      accessibilityLabel={`Add a ${label.toLowerCase()} ritual`}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      // Card-shaped, so it takes the corner the user set rather than one of
      // its own — it becomes a ritual card the moment it's pressed.
      style={[styles.add, { borderColor: alpha(colors.rule, 0.9), borderRadius: radius }]}
    >
      <Plus size={15} color={colors.inkMuted} />
      <Text style={[styles.addText, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
    </PressableScale>
  );
}

function RitualEditor({ ritual }: { ritual: Ritual }) {
  const colors = usePalette();
  const type = useType();
  const patch = useRitualStore((s) => s.patch);
  const remove = useRitualStore((s) => s.remove);
  const { data: routines } = useRoutines();
  const ink = useCardInk();

  const routine = routines?.find((r) => r.id === ritual.ref) ?? null;
  const shade = ink(ritual.kind === "journal" ? "honey" : routine ? hueOf(routine) : "zest");
  const Icon = RITUAL_ICON[ritual.kind];

  // Picking a routine renames the ritual to match, so the planner has one
  // title and it is the one you can still edit by hand afterwards.
  const pick = (next: Routine | null) => {
    hapticTap();
    patch(ritual.id, next ? { ref: next.id, label: next.name } : { ref: "" });
  };

  return (
    <Animated.View layout={settle()} entering={FadeIn.duration(180)}>
      <Panel style={[styles.card, !ritual.enabled && styles.cardOff]}>
        <View style={styles.head}>
          <View style={[styles.disc, { backgroundColor: alpha(shade.solid, 0.16) }]}>
            <Icon size={16} color={shade.stamp} />
          </View>
          <TextInput
            value={ritual.label}
            onChangeText={(label) => patch(ritual.id, { label })}
            placeholder={ritual.kind === "gym" ? "Training" : "Meals"}
            placeholderTextColor={alpha(colors.inkMuted, 0.5)}
            accessibilityLabel="Ritual name"
            style={[styles.name, type.display, { color: colors.ink }]}
          />
          <Switch
            value={ritual.enabled}
            onValueChange={(enabled) => {
              hapticTap();
              patch(ritual.id, { enabled });
            }}
            trackColor={{ true: shade.solid, false: alpha(colors.ink, 0.15) }}
            thumbColor={colors.surface}
          />
        </View>
        <Text style={[styles.summary, type.sans, { color: colors.inkMuted }]}>
          {describeSchedule(ritual)}
        </Text>

        <Divider />
        <Eyebrow>on these days</Eyebrow>
        <View style={styles.days}>
          {WEEK.map(({ day, letter, name }) => {
            const on = ritual.days.includes(day);
            return (
              <PressableScale
                key={day}
                scaleTo={0.88}
                accessibilityLabel={name}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  hapticTap();
                  patch(ritual.id, { days: toggleDay(ritual.days, day) });
                }}
                style={[
                  styles.day,
                  on
                    ? { backgroundColor: shade.solid }
                    : { backgroundColor: alpha(colors.ink, 0.05) },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    type.sansSemiBold,
                    { color: on ? colors.paper : colors.inkMuted },
                  ]}
                >
                  {letter}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Divider />
        <Eyebrow>{ritual.times.length > 1 ? "at these times" : "at this time"}</Eyebrow>
        <View style={styles.times}>
          {ritual.times.map((minutes, i) => (
            <View key={`${minutes}-${i}`} style={styles.timeRow}>
              <Stepper
                name="time"
                value={minutes}
                display={fmtMin(minutes)}
                step={TIME_STEP}
                min={0}
                max={DAY_MINUTES - TIME_STEP}
                width={56}
                onChange={(v) => patch(ritual.id, { times: setTime(ritual.times, i, v) })}
              />
              {/* The last slot stays: a ritual with no time has no place to
                  land, and deleting the ritual is the way to say that. */}
              {ritual.times.length > 1 && (
                <PressableScale
                  scaleTo={0.85}
                  accessibilityLabel={`Remove the ${fmtMin(minutes)} slot`}
                  hitSlop={8}
                  onPress={() => {
                    hapticTap();
                    patch(ritual.id, { times: removeTime(ritual.times, i) });
                  }}
                  style={styles.timeDrop}
                >
                  <Trash2 size={14} color={alpha(colors.inkMuted, 0.6)} />
                </PressableScale>
              )}
            </View>
          ))}
          <PressableScale
            scaleTo={0.95}
            accessibilityLabel="Add another time"
            onPress={() => {
              hapticTap();
              patch(ritual.id, { times: addTime(ritual.times) });
            }}
            style={[styles.addTime, { borderColor: alpha(colors.rule, 0.9) }]}
          >
            <Plus size={13} color={colors.inkMuted} />
            <Text style={[styles.addTimeText, type.sansMedium, { color: colors.inkMuted }]}>
              another
            </Text>
          </PressableScale>
        </View>

        {ritual.kind === "gym" && (
          <>
            <Divider />
            <Eyebrow>the routine</Eyebrow>
            <View style={styles.routines}>
              <Chip label="Any" on={!ritual.ref} accent={shade.solid} onPress={() => pick(null)} />
              {(routines ?? []).map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  on={ritual.ref === r.id}
                  accent={shade.solid}
                  onPress={() => pick(r)}
                />
              ))}
            </View>

            <Divider />
            <View style={styles.lengthRow}>
              <View style={styles.lengthText}>
                <Text style={[styles.rowLabel, type.sansMedium, { color: colors.ink }]}>
                  Length
                </Text>
                <Text style={[styles.rowHint, type.sans, { color: colors.inkMuted }]}>
                  How much of the timeline it blocks out.
                </Text>
              </View>
              <Stepper
                name="minutes"
                value={ritual.dur_min}
                display={`${ritual.dur_min}m`}
                step={15}
                min={15}
                max={4 * 60}
                width={44}
                onChange={(dur_min) => patch(ritual.id, { dur_min })}
              />
            </View>
          </>
        )}

        <Divider />
        <PressableScale
          scaleTo={0.97}
          accessibilityLabel={`Delete the ${ritual.label} ritual`}
          onPress={() =>
            confirmDestructive(
              `Delete “${ritual.label}”?`,
              "The schedule goes; your sessions and entries stay exactly as they are.",
              "Delete ritual",
              () => remove(ritual.id),
            )
          }
          style={styles.delete}
        >
          <Trash2 size={14} color={colors.clay} />
          <Text style={[styles.deleteText, type.sansMedium, { color: colors.clay }]}>
            Delete ritual
          </Text>
        </PressableScale>
      </Panel>
    </Animated.View>
  );
}

function Chip({
  label,
  on,
  accent,
  onPress,
}: {
  label: string;
  on: boolean;
  accent: string;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.94}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[
        styles.chip,
        on
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: "transparent", borderColor: alpha(colors.rule, 0.9) },
      ]}
    >
      <Text
        style={[styles.chipText, type.sansMedium, { color: on ? colors.paper : colors.inkMuted }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function Divider() {
  const colors = usePalette();
  return <View style={[styles.divider, { backgroundColor: alpha(colors.rule, 0.5) }]} />;
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerIcon: {
    height: 40,
    width: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: { flex: 1, minWidth: 0 },
  bannerTitle: { fontSize: 20 },
  bannerSub: { marginTop: 1, fontSize: 12.5 },
  card: { marginTop: 12, padding: 14, overflow: "hidden" },
  cardOff: { opacity: 0.6 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  disc: {
    height: 32,
    width: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { flex: 1, minWidth: 0, fontSize: 18, letterSpacing: -0.3, paddingVertical: 2 },
  summary: { marginTop: 6, fontSize: 12 },
  divider: { height: 1, marginVertical: 12 },
  days: { marginTop: 8, flexDirection: "row", gap: 6 },
  day: {
    flex: 1,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 12.5 },
  times: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  timeDrop: { height: 34, width: 26, alignItems: "center", justifyContent: "center" },
  addTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingHorizontal: 11,
  },
  addTimeText: { fontSize: 11.5 },
  routines: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12.5 },
  lengthRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lengthText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 14.5 },
  rowHint: { marginTop: 2, fontSize: 12 },
  delete: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start" },
  deleteText: { fontSize: 13 },
  addRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  add: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 16,
  },
  addText: { fontSize: 13 },
});
