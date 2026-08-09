import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { Grain } from "@/components/grain";
import { Eyebrow, Key } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { useCardInk } from "@/features/workouts/hues";
import { localDateOf } from "@/lib/dates";
import { dur, ease, settle } from "@/lib/motion";
import { SHEET_OVERHANG } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import { useElevation, usePalette, useType } from "@/stores/theme";
import { liveTrackers, useEntriesDay, useTrackers } from "../api";
import { EntryComposer } from "./EntryComposer";
import { EntryRow } from "./EntryRow";

const WEB = Platform.OS === "web";

interface LogSheetStore {
  /** The tracker to log against, "" for "let me pick", null for closed. */
  tracker: string | null;
  /** What the slot was called, so the sheet can say what it is answering. */
  label: string;
}

const useLogSheetStore = create<LogSheetStore>(() => ({ tracker: null, label: "" }));

/** Open the log sheet. `tracker` empty means the ritual never picked one, so
 * the sheet asks which — a slot that says "anything counts" cannot decide for
 * you, and guessing would file it under the wrong thing. */
export const openLog = (tracker: string, label = "") =>
  useLogSheetStore.setState({ tracker, label });

export const closeLog = () => useLogSheetStore.setState({ tracker: null, label: "" });

/** Logging without leaving the day.
 *
 * A ritual slot on Today is a question the day is asking — "lunch?" — and the
 * answer belongs where the question is. Sending you to another space to answer
 * it was the whole reason logging felt like a chore: you had to leave what you
 * were looking at, arrive somewhere with no idea which slot you came from, and
 * pick the tracker again by hand.
 *
 * Mounted once above the navigator, like the menu host, so every view that
 * draws a slot (agenda, timeline, week) gets it for free. */
export function LogSheetHost() {
  const tracker = useLogSheetStore((s) => s.tracker);
  return (
    <Modal
      visible={tracker !== null}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeLog}
    >
      {tracker !== null && <LogSheet trackerId={tracker} />}
    </Modal>
  );
}

function LogSheet({ trackerId }: { trackerId: string }) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const radius = useCardRadius();
  const elevation = useElevation("lifted");

  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      style={[styles.backdrop, WEB && styles.centred, { backgroundColor: alpha(colors.ink, 0.35) }]}
    >
      <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={closeLog} />
      <Animated.View
        entering={WEB ? FadeIn.duration(dur.quick) : SlideInDown.duration(dur.moved).easing(ease.out)}
        layout={settle()}
        style={[
          WEB ? styles.card : styles.sheet,
          WEB && elevation,
          {
            backgroundColor: colors.surface,
            borderColor: alpha(colors.rule, 0.7),
            paddingBottom: WEB ? 18 : insets.bottom + 12 + SHEET_OVERHANG,
            marginBottom: WEB ? 0 : -SHEET_OVERHANG,
            ...(WEB
              ? { borderRadius: radius }
              : { borderTopLeftRadius: radius, borderTopRightRadius: radius }),
          },
        ]}
      >
        <Grain radius={radius - 1} />
        {!WEB && <View style={[styles.grabber, { backgroundColor: alpha(colors.inkMuted, 0.3) }]} />}
        <Body trackerId={trackerId} />
      </Animated.View>
    </Animated.View>
  );
}

function Body({ trackerId }: { trackerId: string }) {
  const colors = usePalette();
  const type = useType();
  const label = useLogSheetStore((s) => s.label);
  const { data: all } = useTrackers();
  const kept = liveTrackers(all);
  const tracker = kept.find((t) => t.id === trackerId) ?? null;

  if (!tracker) return <Picker label={label} />;

  return (
    <View style={styles.body}>
      {!!label && (
        <Text numberOfLines={1} style={[styles.head, type.display, { color: colors.ink }]}>
          {label}
        </Text>
      )}
      <EntryComposer tracker={tracker} onLogged={closeLog} />
      <Already trackerId={tracker.id} />
    </View>
  );
}

/** What the slot has already collected today.
 *
 * Answering "did I already log lunch?" is most of why anyone opens this twice,
 * and the answer costs nothing: the day's entries are already loaded for the
 * slots themselves. Editable, because a sentence you just wrote is the one
 * thing you are most likely to want to fix. */
function Already({ trackerId }: { trackerId: string }) {
  const today = localDateOf(new Date().toISOString());
  const { data: entries } = useEntriesDay(today);
  const { data: all } = useTrackers();
  const tracker = (all ?? []).find((t) => t.id === trackerId);
  const mine = (entries ?? []).filter((e) => e.tracker === trackerId);

  if (!tracker || mine.length === 0) return null;
  return (
    <View style={styles.already}>
      <Eyebrow>already today</Eyebrow>
      {mine.map((entry) => (
        <EntryRow key={entry.id} entry={entry} tracker={tracker} />
      ))}
    </View>
  );
}

/** A slot pointed at nothing in particular: which of your trackers is this? */
function Picker({ label }: { label: string }) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const { data: all } = useTrackers();
  const kept = liveTrackers(all);

  return (
    <View style={styles.body}>
      <Text style={[styles.head, type.display, { color: colors.ink }]}>
        {label || "What are you logging?"}
      </Text>
      {kept.length === 0 ? (
        <Text style={[styles.none, type.sans, { color: colors.inkMuted }]}>
          You are not tracking anything yet. Account, under &ldquo;what you track&rdquo;.
        </Text>
      ) : (
        <View style={styles.choices}>
          {kept.map((t) => (
            <Key
              key={t.id}
              label={t.name}
              tint={ink(t.hue).stamp}
              onPress={() => openLog(t.id, t.name)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  centred: { alignItems: "center", justifyContent: "center", padding: 24 },
  sheet: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8, overflow: "hidden" },
  card: { width: "100%", maxWidth: 420, borderWidth: 1, padding: 16, overflow: "hidden" },
  grabber: { height: 4, width: 40, borderRadius: 999, alignSelf: "center", marginBottom: 12 },
  body: { gap: 12, paddingBottom: 8 },
  head: { fontSize: 20, letterSpacing: -0.4 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  none: { fontSize: 13.5, lineHeight: 19 },
  already: { gap: 8 },
});
