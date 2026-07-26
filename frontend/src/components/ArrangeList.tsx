import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Eye, EyeOff } from "lucide-react-native";
import { hapticTap } from "@/lib/haptics";
import { dur, gesture, timing } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { toggleKey } from "@/features/home/layout";

export const ROW_H = 52;

export interface ArrangeItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

/** A short list the user owns: hold a row to lift and reorder it (the app's
 * hold-to-lift convention — no handles), tap the eye to tuck it away. Fixed
 * row height keeps the slot math trivial; both the dock editor and Home's
 * arrange mode are this component. */
export function ArrangeList({
  items,
  order,
  hidden,
  onChange,
}: {
  items: readonly ArrangeItem[];
  order: readonly string[];
  hidden: readonly string[];
  onChange: (order: string[], hidden: string[]) => void;
}) {
  // Rows read their slot from this shared map so a drag displaces neighbours
  // live — AgendaSheet's ReorderableRows pattern, minus variable heights.
  const keys = order.filter((k) => items.some((i) => i.key === k));
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(keys.map((k, i) => [k, i])),
  );
  const keysKey = keys.join(",");

  useEffect(() => {
    positions.value = Object.fromEntries(keys.map((k, i) => [k, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey]);

  const commit = () => {
    const known = [...keys].sort(
      (a, b) => (positions.value[a] ?? 0) - (positions.value[b] ?? 0),
    );
    const unknown = order.filter((k) => !keys.includes(k));
    onChange([...known, ...unknown], [...hidden]);
  };

  return (
    <View style={{ height: keys.length * ROW_H }}>
      {keys.map((key) => {
        const item = items.find((i) => i.key === key);
        if (!item) return null;
        return (
          <Row
            key={key}
            item={item}
            positions={positions}
            count={keys.length}
            hidden={hidden.includes(key)}
            onToggle={() => {
              hapticTap();
              onChange([...order], toggleKey([...hidden], key));
            }}
            onDrop={commit}
          />
        );
      })}
    </View>
  );
}

function Row({
  item,
  positions,
  count,
  hidden,
  onToggle,
  onDrop,
}: {
  item: ArrangeItem;
  positions: SharedValue<Record<string, number>>;
  count: number;
  hidden: boolean;
  onToggle: () => void;
  onDrop: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const dragging = useSharedValue(false);
  const y = useSharedValue((positions.value[item.key] ?? 0) * ROW_H);
  const startY = useSharedValue(0);

  // Follow the slot map whenever this row isn't the one being held.
  useAnimatedReaction(
    () => positions.value[item.key],
    (slot) => {
      if (slot != null && !dragging.value) y.value = withTiming(slot * ROW_H, timing());
    },
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      dragging.value = true;
      startY.value = (positions.value[item.key] ?? 0) * ROW_H;
      y.value = startY.value;
      runOnJS(hapticTap)();
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      const slot = Math.max(0, Math.min(count - 1, Math.round(y.value / ROW_H)));
      const current = positions.value[item.key] ?? 0;
      if (slot === current) return;
      const next = { ...positions.value };
      for (const k in next) {
        if (k === item.key) continue;
        if (current < slot && next[k] > current && next[k] <= slot) next[k] -= 1;
        else if (current > slot && next[k] >= slot && next[k] < current) next[k] += 1;
      }
      next[item.key] = slot;
      positions.value = next;
    })
    .onEnd(() => {
      // The finger let go: a gesture spring seats the row in its slot.
      y.value = withSpring((positions.value[item.key] ?? 0) * ROW_H, gesture.snap);
      runOnJS(onDrop)();
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { scale: withTiming(dragging.value ? 1.02 : 1, timing(dur.instant)) },
    ],
    zIndex: dragging.value ? 2 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, style]}>
        {item.icon}
        <Text
          numberOfLines={1}
          style={[type.sansMedium, styles.label, { color: colors.ink }, hidden && styles.dimmed]}
        >
          {item.label}
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: !hidden }}
          accessibilityLabel={`Show ${item.label}`}
          onPress={onToggle}
          hitSlop={8}
          style={styles.eye}
        >
          {hidden ? (
            <EyeOff size={18} color={alpha(colors.inkMuted, 0.7)} />
          ) : (
            <Eye size={18} color={colors.inkMuted} />
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: { flex: 1, fontSize: 15 },
  dimmed: { opacity: 0.45 },
  eye: { padding: 6 },
});
