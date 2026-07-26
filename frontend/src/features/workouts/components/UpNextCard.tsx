import { Pressable, StyleSheet, Text, View } from "react-native";
import { Panel, Stamp, StampButton } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import { usePalette, useType } from "@/stores/theme";
import { focusOf, hueOf } from "../focus";
import { useCardInk } from "../hues";
import { sinceLabel } from "../rotation";
import type { Routine } from "../types";
import { useEmblem } from "../emblem";
import { Watermark } from "./card-parts";

/** The page's answer to "what am I doing today" — the next routine in your
 * split, in its own colour, with the one Start on the page. Tapping the card
 * opens the routine; only the stamp begins a session. */
export function UpNextCard({
  routine,
  programName,
  lastDone,
  onStart,
  onOpen,
}: {
  routine: Routine;
  programName: string;
  lastDone: string | null;
  onStart: () => void;
  onOpen: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const hue = hueOf(routine);
  const ink = useCardInk()(hue);
  const emblem = useEmblem(routine.emblem);

  const count = routine.items.length;
  const focus = focusOf(routine.items);
  const meta = [
    `${count} ${count === 1 ? "exercise" : "exercises"}`,
    focus?.label,
    sinceLabel(lastDone),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Panel style={[styles.card, { backgroundColor: ink.field }]}>
      <Watermark strokes={emblem} tint={ink.mark} size={168} />

      <Pressable accessibilityLabel={`Open ${routine.name}`} onPress={onOpen}>
        <View style={styles.stampRow}>
          <Stamp color={ink.stamp} rotate={-3}>
            up next
          </Stamp>
          <Text numberOfLines={1} style={[type.sansMedium, styles.program, { color: colors.inkMuted }]}>
            {programName}
          </Text>
        </View>

        <Text numberOfLines={2} style={[fontStyle("fraunces", "900"), styles.name, { color: colors.ink }]}>
          {routine.name}
        </Text>
        <Text numberOfLines={1} style={[type.sans, styles.meta, { color: colors.inkMuted }]}>
          {meta}
        </Text>
      </Pressable>

      <StampButton color={ink.stamp} onPress={onStart} style={styles.start}>
        <Text style={[type.sansSemiBold, styles.startText, { color: ink.field }]}>Start</Text>
      </StampButton>
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, overflow: "hidden" },
  stampRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  program: { flex: 1, fontSize: 10, letterSpacing: 1.8, textTransform: "uppercase" },
  name: { marginTop: 10, fontSize: 34, letterSpacing: -1 },
  meta: { marginTop: 5, fontSize: 12.5 },
  start: { alignSelf: "flex-start", marginTop: 18, paddingHorizontal: 30, paddingVertical: 13 },
  startText: { fontSize: 13, letterSpacing: 2.6, textTransform: "uppercase" },
});
