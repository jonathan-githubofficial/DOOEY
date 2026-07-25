import { MenuView } from "@react-native-menu/menu";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { MoreHorizontal } from "lucide-react-native";
import { useRef } from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { hapticTap } from "@/lib/haptics";
import { openSheet, type Menu } from "@/stores/sheet";
import { usePalette } from "@/stores/theme";

/** Expo Go ships a fixed set of native modules and the menu isn't one of them,
 * so there it falls back to the app's own popover. A dev build gets the real
 * thing. The web has no native menu to reach for at all. */
const NATIVE =
  Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

interface Props {
  label: string;
  menu: () => Menu;
  style?: StyleProp<ViewStyle>;
}

/** The ⋯ affordance, everywhere in the app: press it and the choices unfold out
 * of it. On a phone that's the platform's own menu, the button itself becoming
 * the menu; elsewhere it's the app's popover, which behaves the same way. */
export function DotsButton(props: Props) {
  return NATIVE ? <NativeDots {...props} /> : <PopoverDots {...props} />;
}

/** UIKit's UIMenu on iOS, a PopupMenu on Android. The system owns the
 * presentation, so the menu is built up front rather than on press. */
function NativeDots({ label, menu, style }: Props) {
  const colors = usePalette();
  const spec = menu();
  return (
    <MenuView
      title={spec.title}
      isAnchoredToRight
      hitSlop={HIT_SLOP}
      testID={label}
      // The id is the action's place in the list — the labels are already
      // unique on screen, but positions can't drift out of sync.
      actions={spec.actions.map((a, i) => ({
        id: String(i),
        title: a.label,
        // SF Symbols only: Android would look the name up as a drawable and
        // find nothing.
        image: Platform.OS === "ios" ? a.symbol : undefined,
        attributes: a.destructive ? { destructive: true } : undefined,
      }))}
      onPressAction={({ nativeEvent }) => spec.actions[Number(nativeEvent.event)]?.onPress()}
      style={[styles.btn, style]}
    >
      <View style={styles.glyph}>
        <MoreHorizontal size={16} color={colors.inkMuted} />
      </View>
    </MenuView>
  );
}

/** The app's own menu: builds its choices on press and measures itself on the
 * way, so the popover can unfold from the button's corner. */
function PopoverDots({ label, menu, style }: Props) {
  const colors = usePalette();
  const ref = useRef<View>(null);

  const press = () => {
    hapticTap();
    const spec = menu();
    if (!ref.current) {
      openSheet(spec);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) =>
      openSheet({ ...spec, anchor: { x, y, width, height } }),
    );
  };

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={press}
      style={[styles.btn, style]}
    >
      <MoreHorizontal size={16} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 28, width: 28, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  glyph: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
});
