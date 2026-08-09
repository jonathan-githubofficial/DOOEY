import { Check as CheckIcon, Play } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { DoodleSvg } from "@/components/DoodleSvg";
import { PressableScale } from "@/components/pressable-scale";
import { Panel, Stamp } from "@/components/surface";
import { fmtMin } from "@/features/tasks/timeGrid";
import { useEmblem } from "@/features/workouts/emblem";
import { settle } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import type { DayRitual } from "../api";
import { RITUAL_ICON, useRitualInk } from "../look";
import { useOpenSlot } from "../open";

/** A standing commitment, drawn as the object it is rather than as a task.
 *
 * There is no checkbox: you do not tick a ritual, you train or you write down
 * what you ate, and the slot reads the answer back off the real record. What
 * the card offers instead is the shortest path to doing the thing — the play
 * disc starts the session from here, without a trip to the gym wall. */
export function RitualSlip({ slot }: { slot: DayRitual }) {
  const colors = usePalette();
  const type = useType();
  const ink = useRitualInk()(slot);
  const open = useOpenSlot();

  const { kind } = slot.ritual;
  const Icon = RITUAL_ICON[kind];
  const emblem = useEmblem(slot.routine?.emblem ?? []);
  const kept = slot.state === "kept";
  const missed = slot.state === "missed";
  // Always the ritual's own label: picking a routine renames the ritual to
  // match, so there is one title and it is the one you can edit.
  const title = slot.ritual.label;

  return (
    <Animated.View layout={settle()} entering={FadeIn.duration(180)}>
      <PressableScale
        scaleTo={0.985}
        accessibilityLabel={`${title}, ${fmtMin(slot.start_min)}, ${slot.note}`}
        onPress={() => open(slot)}
      >
        <Panel
          style={[
            styles.slip,
            // A missed slot keeps its outline and loses its fill: the shape of
            // the day stays legible, the thing that didn't happen recedes.
            missed
              ? { backgroundColor: "transparent", borderColor: alpha(colors.rule, 0.9) }
              : { backgroundColor: ink.field },
            kept && styles.keptSlip,
          ]}
        >
          <View style={[styles.disc, { backgroundColor: alpha(ink.solid, kept ? 0.22 : 0.16) }]}>
            {kind === "training" && emblem.length > 0 ? (
              <View style={styles.emblem}>
                <DoodleSvg strokes={emblem} strokeWidth={4} tint={ink.stamp} opacity={0.9} />
              </View>
            ) : (
              <Icon size={17} color={ink.stamp} />
            )}
          </View>

          <View style={styles.body}>
            <View style={styles.titleLine}>
              <Text numberOfLines={1} style={[styles.title, type.display, { color: colors.ink }]}>
                {title}
              </Text>
              <Stamp rotate={-4} color={missed ? alpha(colors.inkMuted, 0.75) : ink.stamp}>
                {fmtMin(slot.start_min)}
              </Stamp>
            </View>
            <Text numberOfLines={1} style={[styles.note, type.sans, { color: colors.inkMuted }]}>
              {slot.note}
            </Text>
          </View>

          {kept ? (
            <View style={[styles.mark, { backgroundColor: alpha(ink.solid, 0.18) }]}>
              <CheckIcon size={15} color={ink.stamp} strokeWidth={3} />
            </View>
          ) : (
            <View style={[styles.mark, { backgroundColor: ink.solid }]}>
              {slot.state === "live" ? (
                <View style={[styles.livePip, { backgroundColor: colors.paper }]} />
              ) : (
                <Play size={14} color={colors.paper} fill={colors.paper} />
              )}
            </View>
          )}
        </Panel>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    overflow: "hidden",
  },
  keptSlip: { opacity: 0.72 },
  disc: {
    height: 38,
    width: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Inset so the drawing reads as art on a disc rather than as a glyph
  // straining at the edges.
  emblem: { ...StyleSheet.absoluteFillObject, margin: 7 },
  body: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flexShrink: 1, minWidth: 0, fontSize: 16, letterSpacing: -0.3 },
  note: { marginTop: 2, fontSize: 12 },
  mark: {
    height: 30,
    width: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  // A live session is already announced by the bar above the dock; here it is
  // just a lit dot, not a second thing throbbing on the page.
  livePip: { height: 9, width: 9, borderRadius: 2 },
});
