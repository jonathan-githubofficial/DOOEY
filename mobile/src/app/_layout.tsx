import { Fraunces_700Bold, Fraunces_900Black } from "@expo-google-fonts/fraunces";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
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
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </QueryClientProvider>
  );
}
