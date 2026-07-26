import { Tabs } from "expo-router";
import {
  Dumbbell,
  FolderOpen,
  House,
  NotebookPen,
  Shapes,
  UserRound,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleSvg } from "@/components/DoodleSvg";
import { Grain } from "@/components/grain";
import { useDock } from "@/features/home/store";
import { useShadow, useStyleStore } from "@/features/style/store";
import { fontStyle } from "@/features/style/tokens";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useType } from "@/stores/theme";
import { settle } from "@/lib/motion";
import { spaceFor, type SpaceRoute } from "@/lib/spaces";

// A pure deceleration curve — the pill glides and stops dead, no overshoot.
const GLIDE = { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) };

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The dock's glyphs. The list of spaces itself lives in `lib/spaces` and the
 * user's arrangement in features/home/store; only the icons are the dock's
 * own business. Account is absent on purpose — your doodled self at the left
 * end of the island is its door. */
const DOCK_ICONS: Partial<Record<SpaceRoute, LucideIcon>> = {
  index: House,
  planner: NotebookPen,
  boards: Shapes,
  projects: FolderOpen,
  gym: Dumbbell,
};

/** The dock: a floating island. The wordmark anchors the left end (its zest
 * full-stop toggles light/dark), your doodled self beside it is the door to
 * Account, and the space tabs follow. The highlight glides between stops on a
 * spring — the RN counterpart of the web dock's layoutId pill. */
export function Dock({ state, navigation }: TabBarProps) {
  const colors = usePalette();
  const shadow = useShadow();
  const insets = useSafeAreaInsets();

  // Task pages are drill-ins of the planner; a board of Boards; a project of
  // Projects; the style studio of Account — the parent stop stays lit there.
  const active = spaceFor(state.routes[state.index].name);

  const stops = useRef<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const placed = useRef(false);

  const place = (key: string, animate: boolean) => {
    const s = stops.current[key];
    if (!s) return;
    if (animate && placed.current) {
      pillX.value = withTiming(s.x, GLIDE);
      pillW.value = withTiming(s.width, GLIDE);
    } else {
      pillX.value = s.x;
      pillW.value = s.width;
      placed.current = true;
    }
  };

  const measure = (key: string) => (e: LayoutChangeEvent) => {
    stops.current[key] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
    if (key === active) place(key, true);
  };

  const dockSpaces = useDock().filter((s) => s.route !== "account");
  const dockKey = dockSpaces.map((s) => s.route).join(",");

  useEffect(() => {
    // Tabs were added/removed/reordered: drop stale stops and mark the pill
    // unplaced. The next onLayout measure of the active stop re-seats it on
    // the reflowed geometry via the non-animated branch of `place` — calling
    // `place` here would both animate across the reflow and seat the pill on
    // stale pre-reflow coordinates for a frame.
    const live = new Set([...dockSpaces.map((s) => s.route), "account"]);
    for (const key of Object.keys(stops.current)) if (!live.has(key)) delete stops.current[key];
    placed.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockKey]);

  useEffect(() => {
    place(active, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const pillStyle = useAnimatedStyle(() => ({
    left: pillX.value,
    width: pillW.value,
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(16, insets.bottom) }]}
    >
      <View
        style={[
          styles.island,
          {
            backgroundColor: alpha(colors.surface, 0.95),
            borderColor: alpha(colors.rule, 0.7),
            shadowOpacity: 0.1 * shadow,
            elevation: Math.round(3 * shadow),
          },
        ]}
      >
        <Grain radius={999} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            pillStyle,
            { backgroundColor: alpha(colors.zest, 0.15), borderColor: alpha(colors.zest, 0.3) },
          ]}
        />
        <AccountCluster
          active={active === "account"}
          onLayout={measure("account")}
          onPress={() => navigation.navigate("account")}
        />
        <View style={[styles.divider, { backgroundColor: alpha(colors.rule, 0.8) }]} />
        {dockSpaces.map((space) => (
          <DockTab
            key={space.route}
            label={space.label}
            icon={DOCK_ICONS[space.route]!}
            doodleKey={space.doodle}
            active={active === space.route}
            onLayout={measure(space.route)}
            onPress={() => navigation.navigate(space.route)}
          />
        ))}
      </View>
    </View>
  );
}

/** Your doodled self and the wordmark, one piece: tap anywhere on it to open
 * Account. The zest full-stop is pure punctuation — theme switching lives on
 * the Account page. */
function AccountCluster({
  active,
  onLayout,
  onPress,
}: {
  active: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const colors = usePalette();
  const user = useAuthStore((s) => s.user);
  const strokes = (user?.avatar_doodle as Stroke[] | null) ?? [];

  return (
    <Pressable
      accessibilityLabel="Account"
      accessibilityState={{ selected: active }}
      onLayout={onLayout}
      onPress={onPress}
      style={styles.cluster}
    >
      <View style={styles.clusterAvatar}>
        {strokes.length ? (
          <DoodleSvg strokes={strokes} strokeWidth={2.4} />
        ) : (
          <UserRound
            size={18}
            strokeWidth={active ? 2.2 : 1.8}
            color={active ? colors.ink : colors.inkMuted}
          />
        )}
      </View>
      {/* The logo is the logo: it keeps the brand face (Fraunces) no matter
          which display font the Style studio picks. */}
      <Text style={[styles.wordmark, fontStyle("fraunces", "900"), { color: colors.ink }]}>
        DOOEY
        <Text style={{ color: colors.zest }}>.</Text>
      </Text>
    </Pressable>
  );
}

function DockTab({
  label,
  icon: Icon,
  doodleKey,
  active,
  onLayout,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  doodleKey: string;
  active: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  // A hand-drawn icon (set in Style studio) replaces the stock glyph when
  // present — unless doodle icons are switched off in the dock.
  const strokes = useStyleStore((s) => (s.dockDoodles ? s.pageDoodles[doodleKey] : undefined));
  const tint = active ? colors.ink : colors.inkMuted;

  return (
    <Animated.View layout={settle} onLayout={onLayout}>
      <Pressable
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={styles.tab}
      >
        {strokes?.length ? (
          <View style={styles.tabDoodle}>
            <DoodleSvg strokes={strokes} strokeWidth={2.6} />
          </View>
        ) : (
          <Icon size={18} strokeWidth={active ? 2.2 : 1.8} color={tint} />
        )}
        {active && (
          <Animated.Text
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={[styles.tabLabel, type.sansMedium, { color: tint }]}
          >
            {label}
          </Animated.Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  island: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    shadowColor: "#282018",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  pill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  cluster: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 999,
  },
  clusterAvatar: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 17,
    letterSpacing: -0.4,
  },
  divider: {
    height: 20,
    width: 1,
    marginHorizontal: 6,
  },
  tab: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  tabDoodle: {
    height: 24,
    width: 24,
  },
  tabLabel: {
    fontSize: 12,
    paddingLeft: 8,
    paddingRight: 2,
  },
});
