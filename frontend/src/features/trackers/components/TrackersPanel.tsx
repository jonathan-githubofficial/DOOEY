import { Archive, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { DotsButton } from "@/components/dots-button";
import { Eyebrow, Key, Panel } from "@/components/surface";
import { useCardInk } from "@/features/workouts/hues";
import { confirmDestructive } from "@/lib/confirm";
import { settle } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { openPrompt, type Menu } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { useDeleteTracker, usePatchTracker, useTrackers } from "../api";
import { SHAPE_SPEC, type Tracker } from "../types";
import { NewTrackerForm } from "./NewTrackerForm";

/** What you have decided to care about.
 *
 * It lives on Account rather than on Stamps because deciding to track your
 * sleep is a thing you do once, in the same breath as choosing your palette
 * and arranging your dock — not something you should have to walk past every
 * time you want to look at what you did last week. Adding one here is what
 * gives it a place on Today, a slot on the planner, and a word the rambler
 * can route into. */
export function TrackersPanel() {
  const colors = usePalette();
  const type = useType();
  const { data: all } = useTrackers();
  const [adding, setAdding] = useState(false);

  const kept = (all ?? []).filter((t) => !t.archived);
  const retired = (all ?? []).filter((t) => t.archived);

  return (
    <Panel style={styles.panel}>
      <Eyebrow>what you track</Eyebrow>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
        Each one gets its own colour, its own way of being logged, and a place on your day.
      </Text>

      <View style={styles.list}>
        {kept.map((tracker) => (
          <TrackerRow key={tracker.id} tracker={tracker} />
        ))}
        {retired.map((tracker) => (
          <TrackerRow key={tracker.id} tracker={tracker} />
        ))}
      </View>

      {adding ? (
        <Animated.View layout={settle()} entering={FadeIn.duration(180)} style={styles.form}>
          <NewTrackerForm onDone={() => setAdding(false)} />
        </Animated.View>
      ) : (
        <Key
          label="Track something"
          icon={<Plus size={13} color={colors.inkMuted} />}
          onPress={() => setAdding(true)}
          style={styles.add}
        />
      )}
    </Panel>
  );
}

/** One tracker: its colour, its name, what it takes, and the ⋯ that retires it.
 *
 * A retired one stays in the list, greyed, because "you used to weigh yourself"
 * is worth seeing — and because putting it back has to be as easy as stopping,
 * or stopping starts to feel like a decision. */
function TrackerRow({ tracker }: { tracker: Tracker }) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk()(tracker.hue);
  const patch = usePatchTracker();
  const remove = useDeleteTracker();

  const spec = SHAPE_SPEC[tracker.shape];
  const takes = tracker.shape === "amount" && tracker.unit ? `Amount in ${tracker.unit}` : spec.label;

  const menu = (): Menu => ({
    title: tracker.name,
    actions: [
      {
        label: "Rename",
        symbol: "pencil",
        icon: <Pencil size={17} color={colors.ink} />,
        onPress: () =>
          openPrompt({
            title: "Rename tracker",
            initial: tracker.name,
            placeholder: "Tracker name",
            confirmLabel: "Save",
            onSubmit: (name) => {
              const next = name.trim();
              if (next) patch.mutate({ id: tracker.id, patch: { name: next } });
            },
          }),
      },
      tracker.archived
        ? {
            label: "Track it again",
            symbol: "arrow.uturn.backward",
            icon: <RotateCcw size={17} color={colors.ink} />,
            onPress: () => patch.mutate({ id: tracker.id, patch: { archived: false } }),
          }
        : {
            label: "Stop tracking",
            symbol: "archivebox",
            icon: <Archive size={17} color={colors.ink} />,
            onPress: () => patch.mutate({ id: tracker.id, patch: { archived: true } }),
          },
      {
        label: "Delete tracker",
        symbol: "trash",
        destructive: true,
        icon: <Trash2 size={17} color={colors.clay} />,
        onPress: () =>
          confirmDestructive(
            `Delete ${tracker.name}?`,
            "Everything logged under it goes too. Stop tracking keeps the history.",
            "Delete tracker",
            () => remove.mutate(tracker.id),
          ),
      },
    ],
  });

  return (
    <Animated.View
      layout={settle()}
      style={[styles.row, { borderTopColor: alpha(colors.rule, 0.5) }, tracker.archived && styles.off]}
    >
      <View style={[styles.dot, { backgroundColor: ink.solid }]} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.name, type.sansMedium, { color: colors.ink }]}>
          {tracker.name}
        </Text>
        <Text style={[styles.takes, type.sans, { color: colors.inkMuted }]}>
          {tracker.archived ? "Stopped" : takes}
        </Text>
      </View>
      <DotsButton label={tracker.name} menu={menu} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, padding: 20 },
  hint: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  list: { marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  off: { opacity: 0.5 },
  dot: { height: 10, width: 10, borderRadius: 999 },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 15 },
  takes: { marginTop: 1, fontSize: 12 },
  add: { marginTop: 16, alignSelf: "flex-start" },
  form: { marginTop: 16 },
});
