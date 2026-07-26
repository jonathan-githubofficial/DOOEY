import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Eyebrow, Panel } from "@/components/surface";

/** The one shell every Home block wears — a Panel led by an eyebrow — so the
 * stack reads as one system no matter what each widget holds. */
export function HomeWidget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel style={styles.panel}>
      <Eyebrow>{title}</Eyebrow>
      <View style={styles.body}>{children}</View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  body: { gap: 2 },
});
