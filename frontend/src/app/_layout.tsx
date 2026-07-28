import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Fraunces_900Black,
} from "@expo-google-fonts/fraunces";
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, usePathname, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BootIntro } from "@/components/BootIntro";
import { Grain } from "@/components/grain";
import { SheetHost } from "@/components/sheet";
import { initSession } from "@/features/auth/api";
import { COMPOSE_SHEET } from "@/features/tasks/compose-sheet";
import { LiveBarHost } from "@/features/workouts/components/LiveBarHost";
import { FRAME_W } from "@/lib/shell";
import { LIGHT_PALETTE, usePalette, useThemeStore } from "@/stores/theme";

SplashScreen.preventAutoHideAsync();

// The tab navigator is the root's anchor: every modal/detail route (compose,
// a workout, a task…) is pushed ON TOP of it, so there is always a screen to
// go back to — even when the app cold-starts or reloads straight onto one.
// Without this, restoring such a route leaves it rootless and "GO_BACK was not
// handled by any navigator" fires on the first dismiss.
export const unstable_settings = { initialRouteName: "(tabs)" };

/** What a crash looks like instead of the app vanishing. A release build has no
 * redbox, so a render error below the root is otherwise indistinguishable from
 * a native crash — which is exactly the ambiguity that makes an "it crashes on
 * launch" report impossible to act on. Shows the message and the top frames,
 * and lets you retry without relaunching. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const frames = (error.stack ?? "").split("\n").slice(0, 12).join("\n");
  return (
    <View style={styles.crash}>
      <ScrollView contentContainerStyle={styles.crashScroll}>
        <Text style={styles.crashKicker}>SOMETHING BROKE</Text>
        <Text style={styles.crashMessage}>{error.message || "Unknown error"}</Text>
        <Text selectable style={styles.crashStack}>
          {frames}
        </Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.crashRetry}>
          <Text style={styles.crashRetryText}>Try again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const theme = useThemeStore((s) => s.theme);
  const themed = usePalette();
  // The front door is always a lit wall — the shell around it must not stay
  // dark when a dark theme is persisted. Onboarding is NOT pinned: it starts
  // light (set at sign-up) and its lighting room previews the theme live,
  // gutters included.
  const gallery = usePathname() === "/login";
  const colors = gallery ? LIGHT_PALETTE : themed;

  // Native chrome (tab bar, sheets, keyboards) draws with UIKit materials
  // that follow the SYSTEM appearance — pin it to DOOEY's theme instead, so
  // light mode keeps a light bar even on a dark phone.
  useEffect(() => {
    if (Platform.OS !== "web") Appearance.setColorScheme(theme);
  }, [theme]);

  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_900Black,
  });

  // Hold the splash until the persisted session has been validated — the tab
  // guard must see settled auth state, never a pre-load "signed out" flicker.
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    initSession().finally(() => setSessionReady(true));
  }, []);

  const ready = fontsLoaded && sessionReady;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={[styles.fill, { backgroundColor: colors.paper }]}>
      {/* The gutters beside the tablet frame are paper too — grain them, or
          the texture visibly stops at the frame's edges. */}
      {Platform.OS === "web" && <Grain tone={gallery ? "light" : undefined} />}
      {/* Navigators bring their own provider, but the live bar hangs outside
          them and still has to clear the home indicator. */}
      <SafeAreaProvider style={styles.fill}>
      <QueryClientProvider client={queryClient}>
        {/* On the web the app sits in a tablet-width frame instead of
            stretching wall-to-wall — room for a sidebar later. */}
        <View style={[styles.fill, Platform.OS === "web" && styles.tabletFrame]}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
            }}
          >
            {/* The new-task drawer is a real native sheet: the system slides
                it up, rounds it, grabs it, and keeps it above the keyboard. */}
            <Stack.Screen
              name="compose"
              // Nothing may be added here that paints a background: the
              // drawer is a Modal inside a transparent screen, and an opaque
              // contentStyle turns it back into a full page.
              options={COMPOSE_SHEET}
            />
          </Stack>
        </View>
        <StatusBar style={theme === "dark" && !gallery ? "light" : "dark"} />
        {/* Above the navigator, so an open session follows you between spaces
            and stays put when a detail page pushes over the tabs. */}
        <LiveBarHost />
        {/* Menus, prompts and confirms all rise from here — after the live
            bar, so a sheet is never opened underneath it. */}
        <SheetHost />
        {/* The front-door flourish, over everything, once per launch. */}
        <BootIntro onDone={() => {}} />
      </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  tabletFrame: {
    width: "100%",
    maxWidth: FRAME_W,
    alignSelf: "center",
  },
  // Deliberately plain: this screen has to render when the theme, the fonts or
  // the stores are the very thing that failed, so it borrows nothing from them.
  crash: { flex: 1, backgroundColor: "#f3f0e9" },
  crashScroll: { padding: 24, paddingTop: 72, gap: 12 },
  crashKicker: { fontSize: 11, letterSpacing: 2, color: "#8a8178" },
  crashMessage: { fontSize: 18, lineHeight: 25, color: "#241f1a" },
  crashStack: {
    fontSize: 11,
    lineHeight: 16,
    color: "#6b635a",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  crashRetry: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#241f1a",
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 22,
  },
  crashRetryText: { color: "#f3f0e9", fontSize: 14, letterSpacing: 0.4 },
});
