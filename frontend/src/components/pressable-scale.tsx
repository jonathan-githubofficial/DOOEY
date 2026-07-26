import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { gesture } from "@/lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that depresses on a spring — things settle, they don't snap.
 * The DOOEY press state, shared by chips, buttons and rows. The springs are
 * tuned near-critical: a quick, controlled dip with no wobble or overshoot.
 *
 * Nothing lifts or zooms on hover. A pointer crossing a wall of cards must not
 * make the page twitch, so press is the only state that moves. `onHoverIn`/
 * `onHoverOut` still pass through for callers that reveal something on hover.
 *
 * `rotate` (degrees) bakes a tilt into the animated transform — a transform in
 * `style` would be overwritten by the animation. */
export function PressableScale({
  scaleTo = 0.96,
  rotate = 0,
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style"> & {
  scaleTo?: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: rotate
      ? [{ rotate: `${rotate}deg` }, { scale: scale.value }]
      : [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      {...props}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, gesture.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, gesture.release);
        onPressOut?.(e);
      }}
    />
  );
}
