import { StyleSheet, Text, View } from "react-native";
import type { Menu } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { leanOf, twinScale } from "../card-metrics";
import { focusOf, hueOf } from "../focus";
import { useCardInk } from "../hues";
import type { Routine } from "../types";
import { CardMenu, CardShell, CardTitle } from "./card-parts";
import { MuscleTwin } from "./MuscleTwin";

/** A routine on the board: its name and how long it runs pinned at the top, and
 * the body it works standing along the bottom.
 *
 * The figures are the card's face. There's no doodle behind them, and no tag
 * under the count, because a shaded chest and a shaded pair of legs say which
 * day this is faster than the word does. They're also what sizes the card: no
 * headroom padding it out, just a bigger drawing for a bigger day. */
export function RoutineCard({
  routine,
  index,
  onOpen,
  menu,
}: {
  routine: Routine;
  index: number;
  onOpen: () => void;
  menu: () => Menu;
}) {
  const count = routine.items.length;
  const hue = hueOf(routine);
  const ink = useCardInk()(hue);
  const focus = focusOf(routine.items);

  return (
    <CardShell
      hue={hue}
      lean={leanOf(index)}
      accessibilityLabel={`Open ${routine.name}`}
      onPress={onOpen}
    >
      <CardMenu label={`${routine.name} options`} menu={menu} />
      <View style={styles.air} />
      <CardTitle title={routine.name} />
      <Count count={count} tint={ink.stamp} />
      <View style={styles.floor}>
        <MuscleTwin
          targets={focus?.targets ?? []}
          secondary={focus?.secondary ?? []}
          tint={ink.stamp}
          scale={twinScale(count)}
        />
      </View>
    </CardShell>
  );
}

/** How long the day is, on the line under its name. The number is set as a
 * numeral in the routine's own accent rather than folded into a sentence: it's
 * the one thing on the card you read as a quantity, and at a glance its size is
 * the whole answer. */
function Count({ count, tint }: { count: number; tint: string }) {
  const colors = usePalette();
  const type = useType();

  if (count === 0) {
    return (
      <Text style={[type.sans, styles.empty, { color: colors.inkMuted }]}>empty — tap to build</Text>
    );
  }
  return (
    <View style={styles.count}>
      <Text style={[type.display, styles.numeral, { color: tint }]}>{count}</Text>
      <Text style={[type.sansMedium, styles.unit, { color: colors.inkMuted }]}>
        {count === 1 ? "exercise" : "exercises"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Just enough that the name clears the ⋯ rather than lining up with it. */
  air: { height: 4 },
  count: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 4 },
  numeral: { fontSize: 20, lineHeight: 22, letterSpacing: -0.6 },
  unit: { fontSize: 8.5, letterSpacing: 1.3, textTransform: "uppercase" },
  empty: { fontSize: 11.5, lineHeight: 22, marginTop: 4 },
  // The floor is the figures' alone, so they're centred on it: with nothing to
  // balance across the card they'd otherwise hug one edge and leave a hole at
  // the other, and the hole would grow every time a shorter routine drew them
  // smaller. The gap above is fixed — the figures grow with the routine, the
  // air between them and the name doesn't.
  floor: { marginTop: 14, marginBottom: -4, alignItems: "center" },
});
