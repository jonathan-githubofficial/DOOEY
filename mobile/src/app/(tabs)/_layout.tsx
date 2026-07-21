import { Redirect, Tabs } from "expo-router";
import { Icon, Label, NativeTabs, VectorIcon } from "expo-router/unstable-native-tabs";
import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { MaterialIcons } from "@expo/vector-icons";
import { Dock } from "@/components/Dock";
import { useStyleStore } from "@/features/style/store";
import { strokePath, type Stroke } from "@/lib/doodle";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

/** The five spaces: SF symbols on iOS, material glyphs on Android — replaced
 * by your hand-drawn page doodles when "doodle icons in dock" is on. */
const SPACES = [
  { name: "index", label: "Planner", sf: "checklist", md: "event-note", doodle: "planner" },
  { name: "calendar", label: "Calendar", sf: "calendar", md: "calendar-month", doodle: "calendar" },
  { name: "boards", label: "Boards", sf: "square.on.square", md: "dashboard", doodle: "boards" },
  { name: "projects", label: "Projects", sf: "folder", md: "folder", doodle: "learning" },
  { name: "account", label: "Account", sf: "person.crop.circle", md: "person", doodle: "account" },
] as const;

/** Every space lives behind this guard — /login is the only public route.
 * Native gets the platform's own tab bar (system materials, fonts and
 * keyboard behaviour); the web build keeps the DOOEY island, which is the
 * legacy web app's dock. */
export default function TabsLayout() {
  const colors = usePalette();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pageDoodles = useStyleStore((s) => s.pageDoodles);
  const dockDoodles = useStyleStore((s) => s.dockDoodles);
  const [icons, setIcons] = useState<Record<string, string>>({});
  if (!isAuthenticated) return <Redirect href="/login" />;

  if (Platform.OS !== "web") {
    // A native tab bar wants bitmaps, not React views — so each doodle is
    // rasterized off-screen and handed over as a template image the system
    // tints like any other tab icon.
    const doodles: Record<string, Stroke[]> = {};
    if (dockDoodles) {
      for (const space of SPACES) {
        const strokes = pageDoodles[space.doodle];
        if (strokes?.length) doodles[space.name] = strokes;
      }
    }

    return (
      <>
        {Object.keys(doodles).length > 0 && (
          <DoodleIconRig doodles={doodles} onCaptured={setIcons} />
        )}
        <NativeTabs tintColor={colors.zest}>
          {SPACES.map((space) => {
            const uri = doodles[space.name] ? icons[space.name] : undefined;
            return (
              <NativeTabs.Trigger key={space.name} name={space.name}>
                {uri ? (
                  <Icon src={{ uri }} />
                ) : Platform.OS === "ios" ? (
                  <Icon sf={space.sf} />
                ) : (
                  <Icon src={<VectorIcon family={MaterialIcons} name={space.md} />} />
                )}
                <Label>{space.label}</Label>
              </NativeTabs.Trigger>
            );
          })}
        </NativeTabs>
      </>
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

const ICON_PX = 96; // captured at ~3× tab-icon size, so strokes stay crisp

/** Off-screen easels: one per doodled space, snapshotted to PNGs whenever the
 * drawings change. Strokes render opaque black — the tab bar reads the alpha
 * and applies its own tint. */
function DoodleIconRig({
  doodles,
  onCaptured,
}: {
  doodles: Record<string, Stroke[]>;
  onCaptured: (icons: Record<string, string>) => void;
}) {
  const shots = useRef<Record<string, ViewShot | null>>({});
  const signature = JSON.stringify(doodles);

  useEffect(() => {
    let live = true;
    // One frame for the easels to paint, then snapshot them all.
    const t = setTimeout(async () => {
      const next: Record<string, string> = {};
      for (const [key, shot] of Object.entries(shots.current)) {
        try {
          const uri = await shot?.capture?.();
          if (uri) next[key] = uri;
        } catch {
          // Leave the space to its stock glyph.
        }
      }
      if (live) onCaptured(next);
    }, 50);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <View pointerEvents="none" style={styles.rig}>
      {Object.entries(doodles).map(([key, strokes]) => (
        <ViewShot
          key={key}
          ref={(r) => {
            shots.current[key] = r;
          }}
          options={{ format: "png", result: "tmpfile", width: ICON_PX, height: ICON_PX }}
          style={styles.shot}
        >
          <Svg viewBox="0 0 100 100" width={ICON_PX} height={ICON_PX}>
            {strokes.map((s, i) => (
              <Path
                key={i}
                d={strokePath(s.points)}
                fill="none"
                stroke="black"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        </ViewShot>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rig: {
    position: "absolute",
    left: -9999,
    top: 0,
  },
  shot: {
    height: ICON_PX,
    width: ICON_PX,
    backgroundColor: "transparent",
  },
});
