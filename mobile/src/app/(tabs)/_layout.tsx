import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs, VectorIcon } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Dock } from "@/components/Dock";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

/** The five spaces: SF symbols on iOS, material glyphs on Android. */
const SPACES = [
  { name: "index", label: "Planner", sf: "checklist", md: "event-note" },
  { name: "calendar", label: "Calendar", sf: "calendar", md: "calendar-month" },
  { name: "boards", label: "Boards", sf: "square.on.square", md: "dashboard" },
  { name: "projects", label: "Projects", sf: "folder", md: "folder" },
  { name: "account", label: "Account", sf: "person.crop.circle", md: "person" },
] as const;

/** Every space lives behind this guard — /login is the only public route.
 * Native gets the platform's own tab bar (system materials, fonts and
 * keyboard behaviour); the web build keeps the DOOEY island, which is the
 * legacy web app's dock. */
export default function TabsLayout() {
  const colors = usePalette();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (Platform.OS !== "web") {
    return (
      <NativeTabs tintColor={colors.zest}>
        {SPACES.map((space) => (
          <NativeTabs.Trigger key={space.name} name={space.name}>
            {Platform.OS === "ios" ? (
              <Icon sf={space.sf} />
            ) : (
              <Icon src={<VectorIcon family={MaterialIcons} name={space.md} />} />
            )}
            <Label>{space.label}</Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }

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
    </Tabs>
  );
}
