import { Redirect, Tabs, usePathname } from "expo-router";
import { Icon, Label, NativeTabs, VectorIcon } from "expo-router/unstable-native-tabs";
import { useEffect, useRef, useState } from "react";
import { PixelRatio, Platform, StyleSheet, View, type ImageSourcePropType } from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import { MaterialIcons } from "@expo/vector-icons";
import { Dock } from "@/components/Dock";
import { useDock } from "@/features/home/store";
import { useStyleStore } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import { strokePath, type Stroke } from "@/lib/doodle";
import { SPACES, type SpaceRoute } from "@/lib/spaces";
import { alpha, type Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

// The tab labels wear Outfit, not the platform's stock sans.
const LABEL_FONT = fontStyle("outfit", "500").fontFamily;

/** Every space lives behind this guard — /login is the only public route.
 * Native gets the platform's own tab bar (system materials, fonts and
 * keyboard behaviour); the web build keeps the DOOEY island, which is the
 * dock the web app used to have. */
export default function TabsLayout() {
  const colors = usePalette();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pageDoodles = useStyleStore((s) => s.pageDoodles);
  const dockDoodles = useStyleStore((s) => s.dockDoodles);
  const [icons, setIcons] = useState<Record<string, string>>({});
  const dock = useDock();
  // Read unconditionally (rules-of-hooks) even though only the native branch
  // below needs it — see the revealed-space comment there for why.
  const pathname = usePathname();
  const strippedPath = pathname === "/" ? "index" : pathname.slice(1);
  const currentSpace = SPACES.find((s) => s.route === strippedPath);

  // Spaces the user has actually stood on this session that aren't in their
  // dock right now — grows only, never shrinks, so a space revealed once (a
  // deep link, a Home widget) keeps its Trigger for the rest of the session
  // instead of popping in and out as navigation moves on elsewhere. Adjusted
  // during render (React's documented pattern for state derived from a prop
  // change: https://react.dev/learn/you-might-not-need-an-effect), not in a
  // useEffect — an effect would only persist the reveal one render after
  // NativeTabs below already needed it, which is exactly the race this
  // whole rewrite exists to close.
  const [revealed, setRevealed] = useState<Set<SpaceRoute>>(new Set());
  if (currentSpace && !dock.some((d) => d.route === currentSpace.route) && !revealed.has(currentSpace.route)) {
    setRevealed((prev) => new Set(prev).add(currentSpace.route));
  }

  if (!isAuthenticated) return <Redirect href="/login" />;

  if (Platform.OS !== "web") {
    const dockRoutes = new Set(dock.map((space) => space.route));
    // Every space needs a Trigger, hidden or not: the native tab bar throws
    // (dev) or silently refocuses (prod) if navigation ever lands on a route
    // that has none. Worse, it throws just the same if the currently
    // *focused* route's own Trigger is merely hidden — so "visible" is never
    // just the dock, it's the dock plus `revealed` plus, critically,
    // wherever the user is standing on THIS render: the effect above only
    // commits a newly-revealed space into state one render later, which is
    // one render too late to save the render that first lands there. Folding
    // `currentSpace` in here directly (not just through `revealed`) is what
    // actually closes that gap; the effect's job is only to keep the space
    // visible after the user has moved on.
    const revealedSpaces = SPACES.filter(
      (space) =>
        !dockRoutes.has(space.route) && (revealed.has(space.route) || space === currentSpace),
    );
    const visibleSpaces = [...dock, ...revealedSpaces];
    const visibleRoutes = new Set(visibleSpaces.map((space) => space.route));
    const hiddenSpaces = SPACES.filter((space) => !visibleRoutes.has(space.route));

    // A native tab bar wants bitmaps, not React views — so each doodle is
    // rasterized off-screen in its real ink colors and handed to the bar
    // as-is (the patched Icon keeps it from being tinted as a template).
    const doodles: Record<string, Stroke[]> = {};
    if (dockDoodles) {
      for (const space of visibleSpaces) {
        const strokes = pageDoodles[space.doodle];
        if (strokes?.length) doodles[space.route] = strokes;
      }
    }

    return (
      <>
        {Object.keys(doodles).length > 0 && (
          <DoodleIconRig doodles={doodles} onCaptured={setIcons} />
        )}
        <NativeTabs
          tintColor={colors.zest}
          labelStyle={{ fontFamily: LABEL_FONT, fontSize: 11 }}
          iconColor={{ default: colors.inkMuted, selected: colors.zest }}
          // Android's Material chrome is what looked "off": a stark surface, a
          // loud secondary-container pill, a grey ripple. Theme all three to
          // DOOEY — a paper-surface bar, a soft zest indicator + ripple. iOS
          // keeps its native translucency instead of a flat fill.
          indicatorColor={alpha(colors.zest, 0.16)}
          rippleColor={alpha(colors.zest, 0.12)}
          {...(Platform.OS === "android"
            ? { backgroundColor: colors.surface }
            : { blurEffect: "systemChromeMaterial" as const })}
        >
          {visibleSpaces.map((space) => {
            const uri = doodles[space.route] ? icons[space.route] : undefined;
            return (
              <NativeTabs.Trigger key={space.route} name={space.route}>
                {uri ? (
                  // __keepColor rides through our expo-router patch (see
                  // patches/) so the bar shows the doodle's real inks instead
                  // of tinting it as a template.
                  <Icon
                    src={{ uri, scale: ICON_SCALE, __keepColor: true } as ImageSourcePropType}
                  />
                ) : Platform.OS === "ios" ? (
                  <Icon sf={space.sf} />
                ) : (
                  <Icon src={<VectorIcon family={MaterialIcons} name={space.md} />} />
                )}
                <Label>{space.label}</Label>
              </NativeTabs.Trigger>
            );
          })}
          {hiddenSpaces.map((space) => (
            <NativeTabs.Trigger key={space.route} name={space.route} hidden />
          ))}
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
      <Tabs.Screen name="boards" options={{ title: "Boards" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="gym" options={{ title: "Gym" }} />
      <Tabs.Screen name="journal" options={{ title: "Journal" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
    </Tabs>
  );
}

// The icon draws at ICON_PT points in the bar. Since switching to full-color
// imageSource icons, the declared `scale` is honored — so the bitmap carries
// PixelRatio× pixels for a crisp render instead of a 1× upscale.
const ICON_PT = 10;
const ICON_SCALE = PixelRatio.get();
const ICON_PX = ICON_PT * ICON_SCALE;
const EASEL_PX = ICON_PX * 2;

/** Off-screen easels: one per doodled space, snapshotted to PNGs whenever the
 * drawings — or the palette they're inked with — change. Strokes keep their
 * chosen ink colors, exactly like the island dock did. */
function DoodleIconRig({
  doodles,
  onCaptured,
}: {
  doodles: Record<string, Stroke[]>;
  onCaptured: (icons: Record<string, string>) => void;
}) {
  const colors = usePalette();
  const shots = useRef<Record<string, ViewShot | null>>({});
  const signature = JSON.stringify(doodles) + JSON.stringify(colors);

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
          <Svg viewBox="0 0 100 100" width={EASEL_PX} height={EASEL_PX}>
            {strokes.map((s, i) => (
              <Path
                key={i}
                d={strokePath(s.points)}
                fill="none"
                stroke={colors[s.color as keyof Palette] ?? colors.ink}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
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
    height: EASEL_PX,
    width: EASEL_PX,
    backgroundColor: "transparent",
  },
});
