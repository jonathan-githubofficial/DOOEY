import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HOVER = { stiffness: 400, damping: 30 };

/** A Pressable that depresses on a spring — things settle, they don't snap.
 * The DOOEY press state, shared by chips, buttons and rows. Damping is high
 * on purpose: a quick, controlled dip, not a wobble.
 *
 * On pointer devices (the web build) it also lifts gently on hover; a tilted
 * button straightens as it lifts, like the legacy web stamp. `rotate`
 * (degrees) bakes the tilt into the animated transform — a transform in
 * `style` would be overwritten by the animation. */
export function PressableScale({
  scaleTo = 0.95,
  hoverTo = 1.02,
  rotate = 0,
  style,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  ...props
}: Omit<PressableProps, "style"> & {
  scaleTo?: number;
  hoverTo?: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const hover = useSharedValue(0);
  const animated = useAnimatedStyle(() => {
    const scaled = scale.value + (hoverTo - 1) * hover.value;
    return {
      transform: rotate
        ? [{ rotate: `${rotate * (1 - hover.value)}deg` }, { scale: scaled }]
        : [{ scale: scaled }],
    };
  });
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
      onHoverIn={(e) => {
        hover.value = withSpring(1, HOVER);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        hover.value = withSpring(0, HOVER);
        onHoverOut?.(e);
      }}
    />
  );
}
