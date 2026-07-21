import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { usePalette, useType } from "@/stores/theme";

/** Slim page header: the doodled page mark, a space title in display type,
 * and per-space actions on the right. */
export function Masthead({
  avatar,
  title,
  children,
}: PropsWithChildren<{ avatar?: ReactNode; title: string }>) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.head}>
      <View style={styles.titleCluster}>
        {avatar}
        <Text numberOfLines={1} style={[styles.title, type.displayBlack, { color: colors.ink }]}>
          {title}
        </Text>
      </View>
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  titleCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  title: {
    fontSize: 30,
    letterSpacing: -0.7,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
