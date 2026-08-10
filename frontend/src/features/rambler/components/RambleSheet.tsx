import { LinearGradient } from "expo-linear-gradient";
import { Check, Mic, Pause, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/pressable-scale";
import { useCardRadius } from "@/features/style/store";
import { fmtMin } from "@/features/tasks/timeGrid";
import { formatValue, type Tracker } from "@/features/trackers/types";
import { dayTitle } from "@/lib/dates";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { dur, ease, settle } from "@/lib/motion";
import { alpha, relight } from "@/lib/theme";
import { usePalette, useThemeStore, useType } from "@/stores/theme";
import { parseRamble, useCommitDraft, useRambleTrackers } from "../api";
import { minutesOf } from "../commit";
import { changed, failed, fire, initialLoop, landed } from "../loop";
import { useRambleSpeech } from "../stt";
import type { DraftEntity, EntryDraft, TaskDraft } from "../types";
import { Waveform } from "./Waveform";

/** How long the transcript has to sit still before it is re-parsed. Short
 * enough that the draft reshapes while you are still talking, long enough that
 * a breath doesn't cost a round trip. */
const SETTLE_MS = 900;

/** The examples that teach the whole feature in one line each. Shown one at a
 * time before anything has been said, because "you may speak now" is not
 * instructions and a list of five is not either. */
const TRY_SAYING = [
  "Schedule all of these tasks for tomorrow",
  "Buy creatine and a notebook, both today",
  "Slept badly, six hours, and I've eaten nothing yet",
  "Gym at five, push day, then dinner with Sam at eight",
];

/** Drives the parse loop as a plain closure (recursion and mutable state stay
 * out of React's sight). Created once per sheet; the handlers it holds are all
 * stable. */
function createDriver(handlers: {
  onDraft: (entities: DraftEntity[]) => void;
  onThinking: (thinking: boolean) => void;
  onStumble: () => void;
}) {
  let state = initialLoop;
  let text = "";
  // Held here rather than closed over, exactly like the transcript: the driver
  // outlives any one render, and a tracker added mid-ramble should be routable
  // on the very next parse.
  let trackers: Tracker[] = [];
  const launch = () => {
    const fired = fire(state);
    if (!fired) return;
    state = fired.state;
    handlers.onThinking(true);
    parseRamble(text, fired.rev, trackers)
      .then((res) => {
        const outcome = landed(state, res.rev);
        state = outcome.state;
        if (outcome.apply) handlers.onDraft(res.entities);
        if (outcome.refire) launch();
        else handlers.onThinking(false);
      })
      .catch(() => {
        const outcome = failed(state);
        state = outcome.state;
        handlers.onStumble();
        if (outcome.refire) launch();
        else handlers.onThinking(false);
      });
  };
  return {
    launch,
    setText: (next: string) => {
      text = next;
      state = changed(state);
    },
    // No `changed()`: the vocabulary widening is not the speaker saying
    // something new, so it must not cost a re-parse on its own.
    setTrackers: (next: Tracker[]) => {
      trackers = next;
    },
  };
}

/** Talking to the app.
 *
 * It takes the whole screen and washes it in the user's accent, which is the
 * one place in DOOEY that happens. The reason is not drama: while you are
 * speaking there is exactly one thing to look at — what it heard — and every
 * bit of paper furniture still on screen would be something else competing for
 * the glance. The app gets out of the way and comes back when you are done.
 *
 * Launched from the drawer's action corner and closes back into it, so this is
 * a state of composing rather than a place you navigate to. */
export function RambleSheet({
  visible,
  onClose,
  onFiled,
}: {
  visible: boolean;
  /** Backed out: land where you came from, the drawer, still open. */
  onClose: () => void;
  /** Stamped: the whole compose job is finished, so the drawer goes too. */
  onFiled: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible && <Surface onClose={onClose} onFiled={onFiled} />}
    </Modal>
  );
}

function Surface({ onClose, onFiled }: { onClose: () => void; onFiled: () => void }) {
  const colors = usePalette();
  const type = useType();
  const dark = useThemeStore((s) => s.theme) === "dark";
  const insets = useSafeAreaInsets();

  const [transcript, setTranscript] = useState("");
  const [entities, setEntities] = useState<DraftEntity[]>([]);
  const [thinking, setThinking] = useState(false);
  const [stumbled, setStumbled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trackers = useRambleTrackers();

  const [driver] = useState(() =>
    createDriver({
      onDraft: (next) => {
        setEntities(next);
        setStumbled(false);
      },
      onThinking: setThinking,
      onStumble: () => setStumbled(true),
    }),
  );
  useEffect(() => driver.setTrackers(trackers), [driver, trackers]);

  const onTranscript = useCallback(
    (text: string) => {
      setTranscript(text);
      driver.setText(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!text.trim()) {
        setEntities([]);
        return;
      }
      timerRef.current = setTimeout(driver.launch, SETTLE_MS);
    },
    [driver],
  );

  const speech = useRambleSpeech(onTranscript);
  const commit = useCommitDraft();

  // Opening this screen *is* pressing the mic: making you press it again would
  // be a second decision about something you already decided.
  const started = useRef(false);
  useEffect(() => {
    if (speech.available && !started.current) {
      started.current = true;
      speech.start();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.available]);

  // One example, held for the life of the sheet. It rotates between openings
  // rather than while you are reading it.
  const [example] = useState(() => TRY_SAYING[Math.floor(Date.now() / 1000) % TRY_SAYING.length]);

  const close = () => {
    if (speech.listening) speech.stop();
    onClose();
  };

  const toggleMic = () => {
    hapticTap();
    if (speech.listening) speech.stop();
    else speech.start(transcript.trim() || undefined);
  };

  const file = () => {
    if (!entities.length || commit.isPending) return;
    hapticSuccess();
    if (speech.listening) speech.stop();
    commit.mutate(entities, { onSuccess: onFiled });
  };

  // The wash: the user's accent, taken down to something you can read white on
  // in either theme. Derived, so a repainted accent repaints this screen too.
  const deep = relight(colors.zest, 62, dark ? 13 : 20);
  const deeper = relight(colors.zest, 55, dark ? 6 : 10);
  const glow = relight(colors.zest, 90, 72);
  const onWash = relight(colors.zest, 24, 96);

  const ready = entities.length > 0;
  const status = speech.listening
    ? "Listening…"
    : thinking
      ? "Thinking…"
      : stumbled
        ? "Couldn't reach the model"
        : speech.available
          ? "Paused"
          : "Type it out";

  return (
    <Animated.View
      entering={SlideInDown.duration(dur.moved).easing(ease.out)}
      style={StyleSheet.absoluteFill}
    >
      <LinearGradient colors={[deeper, deep, deeper]} style={StyleSheet.absoluteFill} />

      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <PressableScale
          scaleTo={0.88}
          accessibilityLabel="Close"
          onPress={close}
          style={[styles.round, { backgroundColor: alpha(onWash, 0.14) }]}
        >
          <X size={18} color={onWash} strokeWidth={2.4} />
        </PressableScale>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* What it heard, building as you speak. Cards come first because
              they are the answer to the only question on this screen. */}
          {entities.map((entity, i) => (
            <Animated.View
              key={`${entity.kind}-${i}`}
              entering={FadeIn.duration(dur.quick)}
              exiting={FadeOut.duration(dur.quick)}
              layout={settle()}
            >
              {entity.kind === "task" ? (
                <TaskDraftCard draft={entity} onWash={onWash} />
              ) : (
                <EntryDraftCard
                  draft={entity}
                  tracker={trackers.find((t) => t.slug === entity.tracker)}
                  onWash={onWash}
                />
              )}
            </Animated.View>
          ))}

          {!ready && (
            <Animated.View entering={FadeIn.duration(dur.quick)} style={styles.prompt}>
              <Text style={[styles.trySaying, type.sansSemiBold, { color: alpha(glow, 0.8) }]}>
                Try saying
              </Text>
              <Text style={[styles.example, type.display, { color: glow }]}>“{example}”</Text>
            </Animated.View>
          )}

          {/* Typing works everywhere, including on a device with no speech
              module and in a room where you cannot talk. */}
          <TextInput
            value={transcript}
            onChangeText={onTranscript}
            placeholder={speech.available ? "…or type it" : "Type what needs doing"}
            placeholderTextColor={alpha(onWash, 0.45)}
            multiline
            style={[styles.input, type.sans, { color: onWash }]}
          />
        </ScrollView>

        <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <Text style={[styles.status, type.sansSemiBold, { color: onWash }]}>{status}</Text>
          <Text style={[styles.hint, type.sans, { color: alpha(onWash, 0.65) }]}>
            Say everything you need to get done.
          </Text>

          <View style={styles.controls}>
            {speech.available ? (
              <PressableScale
                scaleTo={0.9}
                accessibilityLabel={speech.listening ? "Pause listening" : "Start talking"}
                onPress={toggleMic}
                style={[styles.round, { backgroundColor: alpha(onWash, 0.14) }]}
              >
                {speech.listening ? (
                  <Pause size={18} color={onWash} strokeWidth={2.4} />
                ) : (
                  <Mic size={18} color={onWash} strokeWidth={2.4} />
                )}
              </PressableScale>
            ) : (
              <View style={styles.round} />
            )}

            <View style={styles.wave}>
              <Waveform live={speech.listening} color={alpha(glow, 0.85)} />
            </View>

            <PressableScale
              scaleTo={0.9}
              accessibilityLabel={
                ready ? `File ${entities.length} ${entities.length === 1 ? "item" : "items"}` : "Nothing to file yet"
              }
              accessibilityState={{ disabled: !ready || commit.isPending }}
              disabled={!ready || commit.isPending}
              onPress={file}
              style={[
                styles.round,
                ready
                  ? { backgroundColor: colors.zest }
                  : { backgroundColor: alpha(onWash, 0.14) },
                commit.isPending && styles.sending,
              ]}
            >
              <Check
                size={20}
                color={ready ? colors.paper : alpha(onWash, 0.5)}
                strokeWidth={2.8}
              />
            </PressableScale>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function whenOf(date: string | null, time: string | null): string {
  return [date ? dayTitle(date) : null, time ? fmtMin(minutesOf(time)) : null]
    .filter(Boolean)
    .join(" · ");
}

/** A drafted task on the wash: a card of frosted ink, not paper. Paper here
 * would be a scrap of the app floating in a place the app has left. */
function TaskDraftCard({ draft, onWash }: { draft: TaskDraft; onWash: string }) {
  const type = useType();
  const radius = useCardRadius();
  const when = whenOf(draft.date, draft.time);
  return (
    <View style={[styles.card, { borderRadius: radius, backgroundColor: alpha(onWash, 0.1) }]}>
      <View style={[styles.tick, { borderColor: alpha(onWash, 0.45) }]} />
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, type.sansMedium, { color: onWash }]}>{draft.title}</Text>
        <Text style={[styles.cardMeta, type.sans, { color: alpha(onWash, 0.6) }]}>
          {[when || "Someday", draft.checklist.length ? `${draft.checklist.length} steps` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </View>
  );
}

function EntryDraftCard({
  draft,
  tracker,
  onWash,
}: {
  draft: EntryDraft;
  tracker: Tracker | undefined;
  onWash: string;
}) {
  const type = useType();
  const radius = useCardRadius();
  const when = whenOf(draft.date, draft.time);
  const label = tracker?.name ?? draft.tracker;
  const measured = tracker && draft.value !== null ? formatValue(tracker, draft.value) : "";
  return (
    <View style={[styles.card, { borderRadius: radius, backgroundColor: alpha(onWash, 0.1) }]}>
      <View style={[styles.stampDot, { backgroundColor: alpha(onWash, 0.45) }]} />
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, type.sansMedium, { color: onWash }]}>
          {[measured, draft.body].filter(Boolean).join(" · ") || label}
        </Text>
        <Text style={[styles.cardMeta, type.sans, { color: alpha(onWash, 0.6) }]}>
          {[label, when].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: 16, paddingBottom: 4 },
  round: { height: 46, width: 46, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  sending: { opacity: 0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  tick: { height: 18, width: 18, borderRadius: 999, borderWidth: 1.5 },
  stampDot: { height: 10, width: 10, borderRadius: 3, marginHorizontal: 4 },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15 },
  cardMeta: { marginTop: 2, fontSize: 11.5 },
  prompt: { paddingTop: 56, paddingBottom: 24, alignItems: "center", gap: 10 },
  trySaying: { fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  example: { fontSize: 24, lineHeight: 32, textAlign: "center", letterSpacing: -0.4 },
  input: { fontSize: 16, minHeight: 40, textAlign: "center", paddingVertical: 4 },
  foot: { paddingHorizontal: 16, alignItems: "center", gap: 2 },
  status: { fontSize: 14 },
  hint: { fontSize: 13 },
  controls: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  wave: { flex: 1, alignItems: "center" },
});
