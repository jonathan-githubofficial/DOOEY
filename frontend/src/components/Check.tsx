import { Check as CheckIcon } from "lucide-react-native";
import { useEffect } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { hapticTap } from "@/lib/haptics";
import { dur, timing } from "@/lib/motion";
import { playScratch } from "@/lib/sounds";
import { alpha } from "@/lib/theme";
import { usePalette } from "@/stores/theme";

/** The tactile checkbox: presses in on tap, the tick lands when done.
 * `gate` marks a learning gate — the ring turns zest until it's cleared. */
export function Check({
  done,
  gate,
  onToggle,
  label,
  size = 22,
}: {
  done: boolean;
  gate?: boolean;
  onToggle: () => void;
  label: string;
  size?: number;
}) {
  const colors = usePalette();
  const tick = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    tick.value = withTiming(done ? 1 : 0, timing(dur.instant));
  }, [done, tick]);
  const tickStyle = useAnimatedStyle(() => ({ transform: [{ scale: tick.value }] }));

  return (
    <PressableScale
      scaleTo={0.78}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={label}
      onPress={() => {
        hapticTap();
        playScratch();
        onToggle();
      }}
      hitSlop={8}
      style={{
        height: size,
        width: size,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: done ? colors.leaf : gate ? colors.zest : colors.rule,
        backgroundColor: done ? colors.leaf : "transparent",
      }}
    >
      <Animated.View style={tickStyle}>
        <CheckIcon size={size * 0.62} strokeWidth={3} color={done ? colors.paper : alpha(colors.ink, 0)} />
      </Animated.View>
    </PressableScale>
  );
}
