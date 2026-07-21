import { Tabs } from "expo-router";
import { CalendarDays, NotebookPen, UserRound, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleSvg } from "@/components/DoodleSvg";
import { Grain } from "@/components/grain";
import { useShadow, useStyleStore } from "@/features/style/store";
import type { Stroke } from "@/lib/doodle";
import { alpha } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore, useType } from "@/stores/theme";

const GLIDE = { stiffness: 480, damping: 34 };
const settle = LinearTransition.springify().stiffness(380).damping(32);

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The dock: a floating island. The wordmark anchors the left end (its zest
 * full-stop toggles light/dark), your doodled self beside it is the door to
 * Account, and the space tabs follow. The highlight glides between stops on a
 * spring — the RN counterpart of the web dock's layoutId pill. */
export function Dock({ state, navigation }: TabBarProps) {
  const colors = usePalette();
  const shadow = useShadow();
  const insets = useSafeAreaInsets();

  const routeName = state.routes[state.index].name;
  // The style studio is a drill-in of account — the parent stop stays lit there.
  const active =
    routeName === "index" ? "planner" : routeName === "calendar" ? "calendar" : "account";

  const stops = useRef<Record<string, { x: number; width: number }>>({});
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const placed = useRef(false);

  const place = (key: string, animate: boolean) => {
    const s = stops.current[key];
    if (!s) return;
    if (animate && placed.current) {
      pillX.value = withSpring(s.x, GLIDE);
      pillW.value = withSpring(s.width, GLIDE);
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
        <DockTab
          label="Planner"
          icon={NotebookPen}
          doodleKey="planner"
          active={active === "planner"}
          onLayout={measure("planner")}
          onPress={() => navigation.navigate("index")}
        />
        <DockTab
          label="Calendar"
          icon={CalendarDays}
          doodleKey="calendar"
          active={active === "calendar"}
          onLayout={measure("calendar")}
          onPress={() => navigation.navigate("calendar")}
        />
      </View>
    </View>
  );
}

/** Your doodled self and the wordmark, one piece: tap anywhere on it to open
 * Account. Only the zest full-stop does something else — it flips the theme. */
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
  const type = useType();
  const toggle = useThemeStore((s) => s.toggle);
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
      <Text style={[styles.wordmark, type.displayBlack, { color: colors.ink }]}>
        DOOEY
        <Text
          suppressHighlighting
          accessibilityLabel="Toggle light / dark mode"
          onPress={toggle}
          style={{ color: colors.zest }}
        >
          .
        </Text>
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
