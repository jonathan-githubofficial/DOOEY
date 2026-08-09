import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { Panel, Stamp } from "@/components/surface";
import { useCardInk } from "@/features/workouts/hues";
import { confirmDestructive } from "@/lib/confirm";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useDeleteEntry, useEditEntry } from "../api";
import { formatValue, type Entry, type Tracker } from "../types";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** One thing on the record: the hour stamped in the tracker's own colour, what
 * was measured, and whatever you said about it.
 *
 * Words edit in place and commit on blur, because there is nothing to confirm
 * about a sentence. A measured entry keeps its words optional — "78, felt
 * bloated" is worth more than either half, and this is where the second half
 * goes without the composer growing a field for it. */
export function EntryRow({ entry, tracker }: { entry: Entry; tracker: Tracker }) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk()(tracker.hue);
  const edit = useEditEntry();
  const remove = useDeleteEntry();
  const [draft, setDraft] = useState<string | null>(null);

  const measured = formatValue(tracker, entry.value);
  const words = draft ?? entry.body;

  const commit = () => {
    const next = (draft ?? "").trim();
    if (draft !== null && next !== entry.body) edit.mutate({ id: entry.id, body: next });
    setDraft(null);
  };

  return (
    <Panel style={styles.entry}>
      <Stamp color={ink.stamp} rotate={-3} style={styles.time}>
        {timeOf(entry.at)}
      </Stamp>
      <View style={styles.said}>
        {!!measured && (
          <Text style={[styles.value, type.display, { color: colors.ink }]}>{measured}</Text>
        )}
        <TextInput
          value={words}
          onChangeText={setDraft}
          onBlur={commit}
          // A measured entry can be wordless and complete; a text one cannot,
          // so only the first invites a note.
          placeholder={measured ? "add a note" : ""}
          placeholderTextColor={alpha(colors.inkMuted, 0.45)}
          accessibilityLabel={`Note on ${tracker.name} at ${timeOf(entry.at)}`}
          multiline
          style={[styles.body, type.sans, { color: colors.ink }]}
        />
      </View>
      <PressableScale
        scaleTo={0.85}
        accessibilityLabel={`Delete this ${tracker.name} entry`}
        hitSlop={8}
        onPress={() =>
          confirmDestructive(
            "Delete this entry?",
            entry.body || `${tracker.name} · ${measured || timeOf(entry.at)}`,
            "Delete",
            () => remove.mutate(entry.id),
          )
        }
        style={styles.drop}
      >
        <Trash2 size={14} color={alpha(colors.inkMuted, 0.55)} />
      </PressableScale>
    </Panel>
  );
}

const styles = StyleSheet.create({
  entry: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  time: { marginTop: 1 },
  said: { flex: 1, minWidth: 0 },
  value: { fontSize: 19, letterSpacing: -0.3, fontVariant: ["tabular-nums"] },
  body: { fontSize: 15.5, paddingVertical: 0, lineHeight: 21 },
  drop: { paddingTop: 3 },
});
