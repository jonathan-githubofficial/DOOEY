import { NotebookPen, UserRound } from "lucide-react-native";
import { Redirect, Tabs } from "expo-router";
import { alpha, fonts } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

/** Every space lives behind this guard — /login is the only public route. */
export default function TabsLayout() {
  const colors = usePalette();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.paper },
        tabBarActiveTintColor: colors.zest,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: alpha(colors.rule, 0.7),
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Planner",
          tabBarIcon: ({ color }) => <NotebookPen size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <UserRound size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
