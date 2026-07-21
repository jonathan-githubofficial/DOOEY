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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initSession } from "@/features/auth/api";
import { usePalette, useThemeStore } from "@/stores/theme";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const theme = useThemeStore((s) => s.theme);
  const colors = usePalette();

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
          }}
        >
          {/* The new-task drawer is a real native sheet: the system slides it
              up, rounds it, grabs it, and keeps it above the keyboard. */}
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
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
