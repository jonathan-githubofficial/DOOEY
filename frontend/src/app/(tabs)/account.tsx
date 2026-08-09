import { ChevronRight, Clapperboard, LogOut, Moon, Palette, SlidersHorizontal, Sun } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePagePadding } from "@/lib/shell";
import { AvatarDoodle } from "@/components/AvatarDoodle";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { signOut } from "@/features/auth/api";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { TrackersPanel } from "@/features/trackers/components/TrackersPanel";
import { alpha } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore, useType } from "@/stores/theme";
import { useLiveBarInset } from "@/features/workouts/live-bar";

/** You: your doodled self, your email, appearance, the doors to the Style
 * studio and Preferences, what you track, and the way out. Called Account
 * until 2026-08-09 — the page is about the person, not the record. The tab
 * guard guarantees a session. */
export default function Account() {
  const colors = usePalette();
  const type = useType();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      {/* Pinned above the scroller: the space's name stays put while its
          contents run under it. */}
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="account" />} title="You" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: page.paddingBottom },
        ]}
      >
        <Panel style={styles.panel}>
          <Eyebrow>account</Eyebrow>
          <View style={styles.identity}>
            <AvatarDoodle />
            <View style={styles.identityText}>
              <Text numberOfLines={1} style={[styles.email, type.display, { color: colors.ink }]}>
                {user?.email}
              </Text>
              <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
                Tap the doodle to redraw yourself.
              </Text>
            </View>
          </View>

          <View style={[styles.appearance, { borderTopColor: alpha(colors.rule, 0.5) }]}>
            <Text style={[styles.appearanceLabel, type.sansMedium, { color: colors.ink }]}>
              Appearance
            </Text>
            <ThemeToggle />
          </View>
        </Panel>

        <PressableScale scaleTo={0.98} onPress={() => router.push("/style")}>
          <Panel style={styles.styleCard}>
            <View style={[styles.styleIcon, { backgroundColor: alpha(colors.zest, 0.15) }]}>
              <Palette size={20} color={colors.zest} />
            </View>
            <View style={styles.styleText}>
              <Text style={[styles.styleTitle, type.display, { color: colors.ink }]}>
                Style studio
              </Text>
              <Text style={[styles.styleSub, type.sans, { color: colors.inkMuted }]}>
                Colours, fonts, corners & grain — make DOOEY yours.
              </Text>
            </View>
            <ChevronRight size={16} color={colors.inkMuted} />
          </Panel>
        </PressableScale>

        <PressableScale scaleTo={0.98} onPress={() => router.push("/wordmark")}>
          <Panel style={styles.styleCard}>
            <View style={[styles.styleIcon, { backgroundColor: alpha(colors.sky, 0.15) }]}>
              <Clapperboard size={20} color={colors.sky} />
            </View>
            <View style={styles.styleText}>
              <Text style={[styles.styleTitle, type.display, { color: colors.ink }]}>
                Wordmark
              </Text>
              <Text style={[styles.styleSub, type.sans, { color: colors.inkMuted }]}>
                Doodle the little animation that greets you at the door.
              </Text>
            </View>
            <ChevronRight size={16} color={colors.inkMuted} />
          </Panel>
        </PressableScale>

        <PressableScale scaleTo={0.98} onPress={() => router.push("/preferences")}>
          <Panel style={styles.styleCard}>
            <View style={[styles.styleIcon, { backgroundColor: alpha(colors.leaf, 0.15) }]}>
              <SlidersHorizontal size={20} color={colors.leaf} />
            </View>
            <View style={styles.styleText}>
              <Text style={[styles.styleTitle, type.display, { color: colors.ink }]}>
                Preferences
              </Text>
              <Text style={[styles.styleSub, type.sans, { color: colors.inkMuted }]}>
                Gym units, rest timer & how the app behaves.
              </Text>
            </View>
            <ChevronRight size={16} color={colors.inkMuted} />
          </Panel>
        </PressableScale>

        <TrackersPanel />

        {/* The way out, at the very bottom, and a real button across the page.
            It was a stamp, which is the shape this app uses for *filing
            something* — pressing it down, keeping it. Leaving is the opposite
            of that, and it should be as easy to hit as it is to mean. */}
        <PressableScale
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={signOut}
          style={[
            styles.signOut,
            { borderColor: alpha(colors.rule, 0.9), backgroundColor: colors.surface },
          ]}
        >
          <LogOut size={17} color={colors.inkMuted} />
          <Text style={[styles.signOutLabel, type.sansMedium, { color: colors.inkMuted }]}>
            Sign out
          </Text>
        </PressableScale>
      </ScrollView>
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
            // Travel = width 68 − padding 8 − knob 28.
            transform: [
              { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 32] }) },
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
  },
  head: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  panel: {
    marginTop: 24,
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
    fontSize: 22,
    letterSpacing: -0.4,
  },
  hint: {
    marginTop: 2,
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
    fontSize: 14,
  },
  gardenPanel: {
    marginTop: 16,
    padding: 20,
  },
  garden: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  gardenCell: {
    height: 30,
    width: 30,
  },
  gardenCount: {
    marginTop: 12,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  signOut: {
    marginTop: 28,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
  },
  signOutLabel: {
    fontSize: 15,
  },
  styleCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
  },
  styleIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  styleText: {
    flex: 1,
    minWidth: 0,
  },
  styleTitle: {
    fontSize: 18,
    letterSpacing: -0.3,
  },
  styleSub: {
    marginTop: 1,
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
