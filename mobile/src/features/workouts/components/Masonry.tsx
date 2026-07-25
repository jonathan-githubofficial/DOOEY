import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

/** Two columns, filled by dropping each card into whichever is currently
 * shorter. Heights come from an estimate rather than measurement, so packing is
 * deterministic across renders and the wall never reshuffles under you.
 *
 * `renderItem` gets the item's original index, not its position in a column —
 * entrance stagger and card lean stay tied to the item, not the layout. */
export function Masonry<T>({
  items,
  estimateHeight,
  renderItem,
  gap = 12,
}: {
  items: T[];
  estimateHeight: (item: T, index: number) => number;
  renderItem: (item: T, index: number) => ReactNode;
  gap?: number;
}) {
  const columns: { item: T; index: number }[][] = [[], []];
  const filled = [0, 0];

  items.forEach((item, index) => {
    const target = filled[0] <= filled[1] ? 0 : 1;
    columns[target].push({ item, index });
    filled[target] += estimateHeight(item, index) + gap;
  });

  return (
    <View style={[styles.row, { gap }]}>
      {columns.map((column, i) => (
        <View key={i} style={[styles.column, { gap }]}>
          {column.map(({ item, index }) => renderItem(item, index))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start" },
  column: { flex: 1, minWidth: 0 },
});
