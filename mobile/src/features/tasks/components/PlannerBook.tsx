import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useCardRadius } from "@/features/style/store";
import { alpha } from "@/lib/theme";
import { usePalette, useThemeStore } from "@/stores/theme";

/** Binding geometry — rings and the sheet's punched holes must agree, so both
 * layers use these: same slot count, same gutter. */
export const RING_COUNT = 3;
export const BINDING_INSET = "16%";

interface Flip {
  from: string;
  dir: number;
}

/** The top-bound planner pad: static wire rings, pages that flip up over the
 * binding (desk-calendar style), and the rest of the pad peeking out below.
 * The flip is hand-driven on shared values (not Keyframes) so it runs on web
 * too: forward peels the old page up over the rings, accelerating like a
 * released flap; back flaps the previous page down and lands on a spring. */
export function PlannerBook({
  page,
  direction,
  renderPage,
}: {
  page: string;
  direction: number;
  renderPage: (page: string) => ReactNode;
}) {
  const colors = usePalette();
  const radius = useCardRadius();

  const [cur, setCur] = useState(page);
  const [flip, setFlip] = useState<Flip | null>(null);
  // Render-time adjust: a new page starts a flip from the old one.
  if (page !== cur) {
    setFlip({ from: cur, dir: direction });
    setCur(page);
  }

  const progress = useSharedValue(1);
  const dirSv = useSharedValue(1);
  const endFlip = () => setFlip(null);

  useEffect(() => {
    if (!flip) return;
    dirSv.value = flip.dir;
    progress.value = 0;
    progress.value =
      flip.dir > 0
        ? withTiming(1, { duration: 420, easing: Easing.bezier(0.5, 0.05, 0.75, 0.55) }, (done) => {
            if (done) runOnJS(endFlip)();
          })
        : withSpring(1, { stiffness: 260, damping: 22, mass: 0.9 }, (done) => {
            if (done) runOnJS(endFlip)();
          });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  // The rotating page: forward → the old page peels 0→140° UP over the rings
  // (positive rotateX, origin top — the web's exact motion); back → the new
  // page flaps down from over the top, 140→0°. It fades only at the very end
  // of a peel.
  const topStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const deg = dirSv.value > 0 ? 140 * p : 140 * (1 - p);
    return {
      opacity: dirSv.value > 0 && p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1,
      transform: [{ perspective: 1400 }, { rotateX: `${deg}deg` }],
    };
  });
  // The page underneath: sits in the pad's shadow until uncovered (forward),
  // or dims as it's covered (back).
  const underStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return dirSv.value > 0
      ? { opacity: 0.9 + 0.1 * p, transform: [{ scale: 0.988 + 0.012 * p }] }
      : { opacity: 1 - 0.25 * p, transform: [{ scale: 1 - 0.012 * p }] };
  });

  const topPage = flip ? (flip.dir > 0 ? flip.from : cur) : null;
  const underPage = flip ? (flip.dir > 0 ? cur : flip.from) : cur;

  return (
    <View style={styles.book}>
      <Rings />
      <Animated.View style={[styles.page, flip ? underStyle : null]}>
        {renderPage(underPage)}
      </Animated.View>
      {flip && topPage && (
        <Animated.View
          pointerEvents="none"
          // Rasterized while it rotates: the 3D flip animates a cached
          // texture instead of re-compositing the grained sheet every frame.
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
          style={[styles.topPage, topStyle]}
        >
          {renderPage(topPage)}
        </Animated.View>
      )}
      <View
        pointerEvents="none"
        style={[
          styles.padEdge,
          {
            marginTop: -11,
            marginHorizontal: 8,
            zIndex: -1,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            backgroundColor: alpha(colors.surface, 0.9),
            borderColor: alpha(colors.rule, 0.6),
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.padEdge,
          {
            marginTop: -11,
            marginHorizontal: 20,
            zIndex: -2,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            backgroundColor: alpha(colors.surface, 0.7),
            borderColor: alpha(colors.rule, 0.5),
          },
        ]}
      />
    </View>
  );
}

/** The binder wire: three slim metal loops that dive into the page's punched
 * holes. They belong to the binder, so they sit above every flipping page. */
function Rings() {
  const colors = usePalette();
  const dark = useThemeStore((s) => s.theme) === "dark";
  return (
    <View pointerEvents="none" style={styles.bindingRow}>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <View key={i} style={styles.bindingSlot}>
          <LinearGradient
            colors={
              dark
                ? ["rgba(255,255,255,0.4)", "rgba(255,255,255,0.1)", "rgba(0,0,0,0.4)"]
                : ["#ffffff", alpha(colors.ink, 0.05), alpha(colors.ink, 0.3)]
            }
            style={[
              styles.ring,
              { borderColor: dark ? "rgba(255,255,255,0.3)" : alpha(colors.ink, 0.4) },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  book: {
    marginTop: 20, // room for the rings arcing over the top edge
  },
  page: {
    zIndex: 1,
    transformOrigin: "top",
  },
  topPage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    transformOrigin: "top",
  },
  padEdge: {
    height: 16,
    borderWidth: 1,
  },
  bindingRow: {
    position: "absolute",
    left: BINDING_INSET,
    right: BINDING_INSET,
    top: -20,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bindingSlot: {
    width: 12,
    alignItems: "center",
  },
  ring: {
    height: 36,
    width: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
});
