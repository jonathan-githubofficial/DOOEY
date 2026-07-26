import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Grain } from "@/components/grain";
import { fontStyle } from "@/features/style/tokens";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { playDooey } from "@/lib/sounds";
import { usePalette } from "@/stores/theme";

// Once per app launch — module scope survives remounts, not a fresh process.
let played = false;

const LETTERS = ["D", "O", "O", "E", "Y"];
const STAGGER = 130; // ms between letters landing
const HOLD = 620; // ms the finished wordmark sits before it clears

/** The front-door flourish: DOOEY springs on letter by letter — each with a
 * light tick — over a chime that sings the name, the zest full-stop pops
 * last, then the whole thing lifts away to reveal the app. Plays once. */
export function BootIntro({ onDone }: { onDone: () => void }) {
  const [gone, setGone] = useState(played);
  if (gone) return null;
  return <BootIntroPlaying onDone={onDone} setGone={setGone} />;
}

function BootIntroPlaying({
  onDone,
  setGone,
}: {
  onDone: () => void;
  setGone: (v: boolean) => void;
}) {
  const colors = usePalette();

  useEffect(() => {
    played = true;
    playDooey();
    const timers = LETTERS.map((_, i) => setTimeout(hapticTap, i * STAGGER));
    const total = LETTERS.length * STAGGER;
    const end = setTimeout(() => {
      hapticSuccess();
      setTimeout(() => {
        setGone(true);
        onDone();
      }, HOLD);
    }, total);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      exiting={FadeOut.duration(360).easing(Easing.out(Easing.cubic))}
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.paper }]}
    >
      <Grain />
      <View style={styles.row}>
        {LETTERS.map((ch, i) => (
          <BootLetter key={i} ch={ch} index={i} color={colors.ink} />
        ))}
        <BootDot color={colors.zest} index={LETTERS.length} />
      </View>
    </Animated.View>
  );
}

/** One letter, springing up from below with a touch of overshoot. */
function BootLetter({ ch, index, color }: { ch: string; index: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(index * STAGGER, withSpring(1, { stiffness: 320, damping: 15, mass: 0.9 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 26 }, { scale: 0.7 + 0.3 * p.value }],
  }));
  return (
    <Animated.Text style={[styles.letter, fontStyle("fraunces", "900"), { color }, style]}>
      {ch}
    </Animated.Text>
  );
}

/** The full-stop lands last with a little bounce — the dot on the i, so to speak. */
function BootDot({ color, index }: { color: string; index: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      index * STAGGER,
      withSequence(
        withTiming(1.4, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(1, { stiffness: 380, damping: 12 }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value), transform: [{ scale: p.value }] }));
  return (
    <Animated.Text style={[styles.letter, fontStyle("fraunces", "900"), { color }, style]}>
      .
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  letter: {
    fontSize: 56,
    letterSpacing: -1,
  },
});
