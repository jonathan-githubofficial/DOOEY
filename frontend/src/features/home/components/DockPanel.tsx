import { StyleSheet, Text } from "react-native";
import { Dumbbell, FolderOpen, Shapes, Utensils } from "lucide-react-native";
import { ArrangeList } from "@/components/ArrangeList";
import { Eyebrow, Panel } from "@/components/surface";
import { spaceOf } from "@/lib/spaces";
import { usePalette, useType } from "@/stores/theme";
import type { DockChoice } from "../layout";
import { useHomeStore } from "../store";

const ICONS = {
  boards: Shapes,
  projects: FolderOpen,
  gym: Dumbbell,
  journal: Utensils,
} as const;

/** The dock belongs to the user: reorder the middle spaces, tuck away the
 * ones you don't visit. Changes land on the bar as you make them — Home and
 * Account are pinned so you can never lock yourself out. */
export function DockPanel() {
  const colors = usePalette();
  const type = useType();
  const order = useHomeStore((s) => s.dockOrder);
  const hidden = useHomeStore((s) => s.dockHidden);
  const setDock = useHomeStore((s) => s.setDock);

  return (
    <Panel style={styles.panel}>
      <Eyebrow>your dock</Eyebrow>
      <Text style={[type.sans, styles.hint, { color: colors.inkMuted }]}>
        Hold to reorder, tap the eye to tuck a space away. Home and Account stay put.
      </Text>
      <ArrangeList
        items={order.flatMap((r) => {
          const space = spaceOf(r);
          const Icon = ICONS[r];
          if (!space) return [];
          return [
            {
              key: r,
              label: space.label,
              icon: <Icon size={18} color={colors.inkMuted} />,
            },
          ];
        })}
        order={order}
        hidden={hidden}
        onChange={(o, h) => setDock(o as DockChoice[], h as DockChoice[])}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
});
