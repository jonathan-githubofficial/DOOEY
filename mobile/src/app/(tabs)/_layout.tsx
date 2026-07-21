import { Redirect, Tabs } from "expo-router";
import { Dock } from "@/components/Dock";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

/** Every space lives behind this guard — /login is the only public route.
 * The tab bar is the dock island; the style studio lives here too (a drill-in
 * of Account) so the dock stays underfoot on it. */
export default function TabsLayout() {
  const colors = usePalette();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Planner" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="boards" options={{ title: "Boards" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
      <Tabs.Screen name="style" options={{ title: "Style studio" }} />
    </Tabs>
  );
}
