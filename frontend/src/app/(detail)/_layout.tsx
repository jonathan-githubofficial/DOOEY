import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

/** Drill-in pages — a task, a board, a project, the style studio. They live
 * above the tab navigator so they push over the tab bar, the native way. Same
 * guard as the tabs: /login is the only public route. */
export default function DetailLayout() {
  const colors = usePalette();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    />
  );
}
