import { LogOut, Moon, Sun } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AvatarDoodle } from "@/components/AvatarDoodle";
import { Eyebrow, Panel } from "@/components/surface";
import { signOut } from "@/features/auth/api";
import { alpha, fonts } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore } from "@/stores/theme";

/** The account space: your doodled self, email, appearance and sign-out.
 * The tab guard guarantees a session, so there's no signed-out branch. */
export default function Account() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Account</Text>

      <Panel style={styles.panel}>
        <Eyebrow>account</Eyebrow>
        <View style={styles.identity}>
          <AvatarDoodle />
          <View style={styles.identityText}>
            <Text style={[styles.email, { color: colors.ink }]} numberOfLines={1}>
              {user?.email}
            </Text>
            <Text style={[styles.hint, { color: colors.inkMuted }]}>
              Tap the doodle to redraw yourself.
            </Text>
          </View>
        </View>

        <View style={[styles.appearance, { borderTopColor: alpha(colors.rule, 0.5) }]}>
          <Text style={[styles.appearanceLabel, { color: colors.ink }]}>Appearance</Text>
          <ThemeToggle />
        </View>

        <Pressable
          onPress={signOut}
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.6 }]}
        >
          <LogOut size={16} color={colors.inkMuted} />
          <Text style={[styles.signOutLabel, { color: colors.inkMuted }]}>Sign out</Text>
        </Pressable>
      </Panel>
    </View>
  );
}

/** A spring-loaded light/dark switch: the knob slides, sun ⇄ moon. */
function ThemeToggle() {
  const colors = usePalette();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === "dark";

  const slide = useRef(new Animated.Value(dark ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(slide, {
      toValue: dark ? 1 : 0,
      stiffness: 500,
      damping: 32,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [dark, slide]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel="Toggle light / dark mode"
      onPress={toggle}
      style={[
        styles.toggle,
        { backgroundColor: dark ? alpha(colors.ink, 0.3) : alpha(colors.honey, 0.25) },
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          { backgroundColor: colors.surface },
          {
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 36] }) },
            ],
          },
        ]}
      >
        {dark ? <Moon size={16} color={colors.sky} /> : <Sun size={16} color={colors.honey} />}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 34,
    letterSpacing: -0.8,
    paddingHorizontal: 4,
  },
  panel: {
    marginTop: 20,
    padding: 28,
  },
  identity: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  email: {
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  hint: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  appearance: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 20,
  },
  appearanceLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
  },
  signOut: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  signOutLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  toggle: {
    height: 36,
    width: 68,
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  knob: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    shadowColor: "#282018",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
