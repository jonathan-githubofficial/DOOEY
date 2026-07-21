import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Keyframe, LinearTransition } from "react-native-reanimated";
import { useCardRadius } from "@/features/style/store";
import { alpha } from "@/lib/theme";
import { usePalette, useThemeStore } from "@/stores/theme";

/** Binding geometry — rings and the sheet's punched holes must agree, so both
 * layers use these: same slot count, same gutter. */
export const RING_COUNT = 3;
export const BINDING_INSET = "16%";

// Forward: the top page peels up and over the rings, revealing the next page
// beneath it. Back: the previous page flaps down from over the top and lands
// with a small paper settle.
const flipAwayExit = new Keyframe({
  0: { opacity: 1, transform: [{ perspective: 1400 }, { rotateX: "0deg" }] },
  85: { opacity: 1, transform: [{ perspective: 1400 }, { rotateX: "120deg" }] },
  100: { opacity: 0, transform: [{ perspective: 1400 }, { rotateX: "140deg" }] },
}).duration(420);
const revealEnter = new Keyframe({
  0: { opacity: 0.85, transform: [{ scale: 0.988 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(420);
const flapDownEnter = new Keyframe({
  0: { opacity: 1, transform: [{ perspective: 1400 }, { rotateX: "140deg" }] },
  70: { opacity: 1, transform: [{ perspective: 1400 }, { rotateX: "-4deg" }] },
  100: { opacity: 1, transform: [{ perspective: 1400 }, { rotateX: "0deg" }] },
}).duration(380);
const coverExit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.988 }] },
}).duration(340);

/** The top-bound planner pad: static wire rings, pages that flip up over the
 * binding (desk-calendar style), and the rest of the pad peeking out below. */
export function PlannerBook({
  page,
  direction,
  children,
}: PropsWithChildren<{ page: string; direction: number }>) {
  const colors = usePalette();
  const radius = useCardRadius();
  return (
    <Animated.View layout={LinearTransition.springify().stiffness(380).damping(34)} style={styles.book}>
      <Rings />
      <Animated.View
        key={page}
        entering={direction > 0 ? revealEnter : flapDownEnter}
        exiting={direction > 0 ? flipAwayExit : coverExit}
        style={styles.page}
      >
        {children}
      </Animated.View>
      {/* The rest of the pad, peeking out under the top page. Static on
          purpose: it's the part of the pad you're NOT flipping. */}
      <View
        pointerEvents="none"
        style={[
          styles.padEdge,
          {
            left: 8,
            right: 8,
            bottom: -5,
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
            left: 20,
            right: 20,
            bottom: -10,
            zIndex: -2,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            backgroundColor: alpha(colors.surface, 0.7),
            borderColor: alpha(colors.rule, 0.5),
          },
        ]}
      />
    </Animated.View>
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
    transformOrigin: "top",
  },
  padEdge: {
    position: "absolute",
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
