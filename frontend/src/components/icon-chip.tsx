import type { LucideIcon } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { alpha } from "@/lib/theme";
import { usePalette } from "@/stores/theme";

/** One square in the composer's action row.
 *
 * A tick means "commit"; these mean "this also has one of those", so they light
 * up rather than confirm. Shared, because the drawer's two halves — writing a
 * task and rambling one out — are one unit, and a row that changed shape when
 * you switched between them would say they were different places. */
export function IconChip({
  Icon,
  label,
  tint,
  active,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  tint: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      scaleTo={0.9}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        active
          ? { borderColor: alpha(tint, 0.5), backgroundColor: alpha(tint, 0.12) }
          : { borderColor: colors.rule },
      ]}
    >
      <Icon size={15} color={active ? tint : colors.inkMuted} />
    </PressableScale>
  );
}

/** The row's own metrics, exported so the send disc and the file stamp sit on
 * exactly the same square as the chips beside them. */
export const CHIP_SIZE = 38;

const styles = StyleSheet.create({
  chip: {
    height: CHIP_SIZE,
    width: CHIP_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
});
