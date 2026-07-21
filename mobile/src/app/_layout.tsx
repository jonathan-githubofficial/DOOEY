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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Grain } from "@/components/grain";
import { initSession } from "@/features/auth/api";
import { usePalette, useThemeStore } from "@/stores/theme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const theme = useThemeStore((s) => s.theme);
  const colors = usePalette();

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
      {Platform.OS === "web" && <Grain />}
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
                presentation: "formSheet",
                sheetAllowedDetents: "fitToContents",
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
                contentStyle: { backgroundColor: colors.surface },
              }}
            />
          </Stack>
        </View>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
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
