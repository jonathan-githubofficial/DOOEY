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
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BootIntro } from "@/components/BootIntro";
import { Grain } from "@/components/grain";
import { initSession } from "@/features/auth/api";
import { LIGHT_PALETTE, usePalette, useThemeStore } from "@/stores/theme";

SplashScreen.preventAutoHideAsync();

// The tab navigator is the root's anchor: every modal/detail route (compose,
// a workout, a task…) is pushed ON TOP of it, so there is always a screen to
// go back to — even when the app cold-starts or reloads straight onto one.
// Without this, restoring such a route leaves it rootless and "GO_BACK was not
// handled by any navigator" fires on the first dismiss.
// eslint-disable-next-line react-refresh/only-export-components
export const unstable_settings = { initialRouteName: "(tabs)" };

const queryClient = new QueryClient();

// The sheet OPENS at these detents (small — the title autofocuses, so the
// keyboard is up from the first frame and stacks its height on top). Once
// open, compose.tsx swaps detents as the keyboard comes and goes — the
// tuning knobs live at the top of that file (DETENTS_KEYBOARD/DETENTS_BARE).
const COMPOSE_DETENTS = [0.15, 0.2];

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
              options={{
                // Snug at rest, drags up for room when notes or the picker
                // unfold. The form fills whichever band it gets, footer on
                // the bottom edge. Height lives in COMPOSE_DETENTS above.
                presentation: "formSheet",
                sheetAllowedDetents: COMPOSE_DETENTS,
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
                contentStyle: { backgroundColor: colors.surface },
              }}
            />
          </Stack>
        </View>
        <StatusBar style={theme === "dark" && !gallery ? "light" : "dark"} />
        {/* The front-door flourish, over everything, once per launch. */}
        <BootIntro onDone={() => {}} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  tabletFrame: {
    width: "100%",
    maxWidth: 840,
    alignSelf: "center",
  },
});
