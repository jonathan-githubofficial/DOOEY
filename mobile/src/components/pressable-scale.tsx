import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that depresses on a spring — things settle, they don't snap.
 * The DOOEY press state, shared by chips, buttons and rows. Damping is high
 * on purpose: a quick, controlled dip, not a wobble.
 *
 * `rotate` (degrees) bakes a static tilt into the animated transform — a
 * transform in `style` would be overwritten by the scale animation. */
export function PressableScale({
  scaleTo = 0.95,
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
        scale.value = withSpring(scaleTo, { stiffness: 650, damping: 40 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { stiffness: 450, damping: 30 });
        onPressOut?.(e);
      }}
    />
  );
}
