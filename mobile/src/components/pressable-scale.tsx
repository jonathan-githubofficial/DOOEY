import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that depresses on a spring — things settle, they don't snap.
 * The DOOEY press state, shared by chips, buttons and rows. */
export function PressableScale({
  scaleTo = 0.93,
  style,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "style"> & { scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { stiffness: 600, damping: 32 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { stiffness: 420, damping: 20 });
        onPressOut?.(e);
      }}
    />
  );
}
