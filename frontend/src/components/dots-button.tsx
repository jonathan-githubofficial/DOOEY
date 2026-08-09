import { MoreHorizontal } from "lucide-react-native";
import { StyleSheet } from "react-native";
import { MenuButton, type MenuButtonProps } from "@/components/menu-button";
import { usePalette } from "@/stores/theme";

/** The ⋯ affordance, everywhere in the app: press it and the choices unfold out
 * of it. One glyph over `MenuButton`, which is where the platform handling
 * lives — the menu belongs to the press, not to the three dots. */
export function DotsButton({ label, menu, style }: MenuButtonProps) {
  const colors = usePalette();
  return (
    <MenuButton label={label} menu={menu} style={[styles.btn, style]}>
      <MoreHorizontal size={16} color={colors.inkMuted} />
    </MenuButton>
  );
}

const styles = StyleSheet.create({
  btn: { height: 28, width: 28, alignItems: "center", justifyContent: "center", borderRadius: 999 },
});
