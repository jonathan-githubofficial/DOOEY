import { MenuView } from "@react-native-menu/menu";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type { PropsWithChildren } from "react";
import { useRef } from "react";
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { hapticTap } from "@/lib/haptics";
import { openSheet, type Menu } from "@/stores/sheet";

/** Expo Go ships a fixed set of native modules and the menu isn't one of them,
 * so there it falls back to the app's own popover. A dev build gets the real
 * thing. The web has no native menu to reach for at all. */
const NATIVE =
  Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

export interface MenuButtonProps {
  label: string;
  menu: () => Menu;
  style?: StyleProp<ViewStyle>;
}

/** Anything you press to get a menu out of.
 *
 * On a phone the button itself *becomes* the menu — UIKit's UIMenu on iOS, a
 * PopupMenu on Android — so the choices unfold out of the thing you pressed and
 * wear the platform's own chrome, including its checkmark for the option you
 * are already on. Everywhere else the app's popover does the same job from the
 * same corner.
 *
 * Extracted from `DotsButton`, which is now one call site of it: a menu is not
 * a property of the ⋯ glyph, it is a property of pressing something. */
export function MenuButton({
  label,
  menu,
  style,
  children,
}: PropsWithChildren<MenuButtonProps>) {
  return NATIVE ? (
    <NativeMenu label={label} menu={menu} style={style}>
      {children}
    </NativeMenu>
  ) : (
    <PopoverMenu label={label} menu={menu} style={style}>
      {children}
    </PopoverMenu>
  );
}

/** The system owns the presentation, so the menu is built up front rather than
 * on press. */
function NativeMenu({ label, menu, style, children }: PropsWithChildren<MenuButtonProps>) {
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
        // The platform draws its own tick for "you are already on this one",
        // which is exactly why a view switcher wants a native menu.
        state: a.selected ? ("on" as const) : undefined,
        attributes: a.destructive ? { destructive: true } : undefined,
      }))}
      onPressAction={({ nativeEvent }) => spec.actions[Number(nativeEvent.event)]?.onPress()}
      style={style}
    >
      <View style={styles.fill}>{children}</View>
    </MenuView>
  );
}

/** The app's own menu: builds its choices on press and measures itself on the
 * way, so the popover can unfold from the button's corner. */
function PopoverMenu({ label, menu, style, children }: PropsWithChildren<MenuButtonProps>) {
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
      style={style}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // MenuView wants a real child to anchor to; this keeps whatever it wraps
  // filling the space the caller gave it.
  fill: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
});
