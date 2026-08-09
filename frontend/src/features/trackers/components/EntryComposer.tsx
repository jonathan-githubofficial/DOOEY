import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { Stepper } from "@/components/stepper";
import { Eyebrow, Panel, StampButton } from "@/components/surface";
import { useCardInk, type CardInk } from "@/features/workouts/hues";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useAddEntry, useLastEntry } from "../api";
import { SHAPE_SPEC, formatDuration, type Tracker } from "../types";

/** How long a fresh duration tracker starts at, in minutes, before it has any
 * history to seed from. One hour is the least surprising thing to be handed;
 * every entry after the first seeds from the last one instead. */
const DURATION_COLD_START = 60;

/** Putting one thing on the record.
 *
 * The control is chosen by the tracker's shape, and every shape that measures
 * something opens holding your last value rather than a blank. Nodding at 78 is
 * faster than typing 78, and a scale logs on the tap itself: there is nothing
 * to confirm about pressing the number 4. */
export function EntryComposer({ tracker, onLogged }: { tracker: Tracker; onLogged?: () => void }) {
  const ink = useCardInk()(tracker.hue);
  const { data: last, isPending } = useLastEntry(tracker.id);
  const add = useAddEntry();

  const log = (next: { body?: string; value?: number }) => {
    hapticTap();
    add.mutate({ tracker: tracker.id, ...next }, { onSuccess: onLogged });
  };

  // Remounts when the seed changes, which is on arrival and after each log, so
  // the control always holds the freshest number without an effect syncing it.
  const seedKey = `${tracker.id}:${last?.id ?? "none"}`;

  return (
    <Panel style={[styles.panel, { backgroundColor: ink.field }]}>
      <Eyebrow>{tracker.name}</Eyebrow>
      {tracker.shape === "text" && (
        <Words key={tracker.id} tracker={tracker} ink={ink} onLog={(body) => log({ body })} />
      )}
      {tracker.shape === "tick" && <Tick ink={ink} onLog={() => log({})} />}
      {tracker.shape === "scale" && (
        <Scale tracker={tracker} ink={ink} onLog={(value) => log({ value })} />
      )}
      {tracker.shape === "amount" && !isPending && (
        <Amount
          key={seedKey}
          tracker={tracker}
          ink={ink}
          seed={last?.value ?? 0}
          onLog={(value) => log({ value })}
        />
      )}
      {tracker.shape === "duration" && !isPending && (
        <Duration
          key={seedKey}
          ink={ink}
          seed={last?.value || DURATION_COLD_START}
          onLog={(value) => log({ value })}
        />
      )}
    </Panel>
  );
}

/** Words, and a stamp to press them down with. The cursor stays afterwards,
 * because things worth writing down arrive in bursts. */
function Words({
  tracker,
  ink,
  onLog,
}: {
  tracker: Tracker;
  ink: CardInk;
  onLog: (body: string) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const field = useRef<TextInput>(null);
  const [draft, setDraft] = useState("");
  const ready = draft.trim().length > 0;

  const send = () => {
    if (!ready) return;
    onLog(draft.trim());
    setDraft("");
    field.current?.focus();
  };

  return (
    <>
      <TextInput
        ref={field}
        value={draft}
        onChangeText={setDraft}
        placeholder={SHAPE_SPEC.text.hint}
        placeholderTextColor={alpha(colors.inkMuted, 0.55)}
        accessibilityLabel={`What to log under ${tracker.name}`}
        multiline
        style={[styles.input, type.sans, { color: colors.ink }]}
      />
      <LogStamp ink={ink} disabled={!ready} onPress={send} />
    </>
  );
}

/** It happened. There is nothing else to say and nothing to type. */
function Tick({ ink, onLog }: { ink: CardInk; onLog: () => void }) {
  return <LogStamp ink={ink} label="Done" onPress={onLog} />;
}

/** The steps, as steps. Pressing one logs it: a scale has no draft state worth
 * confirming, and making you press the number and then a stamp would double the
 * cost of the cheapest thing in the app. */
function Scale({
  tracker,
  ink,
  onLog,
}: {
  tracker: Tracker;
  ink: CardInk;
  onLog: (value: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const steps = [];
  for (let n = tracker.min; n <= tracker.max; n++) steps.push(n);

  return (
    <View style={styles.steps}>
      {steps.map((n) => (
        <PressableScale
          key={n}
          scaleTo={0.88}
          accessibilityLabel={`${tracker.name} ${n} of ${tracker.max}`}
          onPress={() => onLog(n)}
          style={[styles.step, { borderColor: alpha(ink.stamp, 0.35) }]}
        >
          <Text style={[styles.stepText, type.display, { color: ink.stamp }]}>{n}</Text>
        </PressableScale>
      ))}
      <View style={styles.stepsSpacer} />
      <Text style={[styles.stepsHint, type.sans, { color: colors.inkMuted }]}>
        of {tracker.max}
      </Text>
    </View>
  );
}

/** A number carrying a unit, opened at whatever it was last time. */
function Amount({
  tracker,
  ink,
  seed,
  onLog,
}: {
  tracker: Tracker;
  ink: CardInk;
  seed: number;
  onLog: (value: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  const [draft, setDraft] = useState(seed ? String(seed) : "");
  const parsed = parseFloat(draft.replace(",", "."));
  const ready = Number.isFinite(parsed);

  return (
    <>
      <View style={styles.amountRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => ready && onLog(parsed)}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={alpha(colors.inkMuted, 0.5)}
          accessibilityLabel={`${tracker.name} in ${tracker.unit || "units"}`}
          style={[styles.amount, type.display, { color: colors.ink }]}
        />
        {!!tracker.unit && (
          <Text style={[styles.unit, type.sans, { color: colors.inkMuted }]}>{tracker.unit}</Text>
        )}
      </View>
      <LogStamp ink={ink} disabled={!ready} onPress={() => onLog(parsed)} />
    </>
  );
}

/** Quarter hours either side of last night. Two taps covers most nights. */
function Duration({
  ink,
  seed,
  onLog,
}: {
  ink: CardInk;
  seed: number;
  onLog: (value: number) => void;
}) {
  const [value, setValue] = useState(seed);
  return (
    <>
      <View style={styles.durationRow}>
        <Stepper
          name="length"
          value={value}
          display={formatDuration(value)}
          step={15}
          min={0}
          onChange={setValue}
        />
      </View>
      <LogStamp ink={ink} disabled={value <= 0} onPress={() => onLog(value)} />
    </>
  );
}

/** The one shape in DOOEY that looks licked and pressed down rather than
 * clicked. Every composer ends with this, whatever it took to fill in. */
function LogStamp({
  ink,
  label = "Log it",
  disabled,
  onPress,
}: {
  ink: CardInk;
  label?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.stampRow}>
      <StampButton color={ink.solid} disabled={disabled} onPress={onPress}>
        <Text style={[styles.stampText, type.sansSemiBold, { color: colors.paper }]}>{label}</Text>
      </StampButton>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, gap: 4, overflow: "hidden" },
  input: { fontSize: 17, minHeight: 28, paddingVertical: 2 },
  stampRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  stampText: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  steps: { marginTop: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  step: {
    height: 42,
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 6,
  },
  stepText: { fontSize: 17, fontVariant: ["tabular-nums"] },
  stepsSpacer: { flex: 1 },
  stepsHint: { fontSize: 12 },
  amountRow: { marginTop: 6, flexDirection: "row", alignItems: "baseline", gap: 8 },
  amount: { fontSize: 34, letterSpacing: -0.8, minWidth: 90, fontVariant: ["tabular-nums"] },
  unit: { fontSize: 15 },
  durationRow: { marginTop: 10, flexDirection: "row" },
});
