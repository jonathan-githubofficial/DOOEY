import { Delete } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"] as const;

/** A docked number pad that stays put while you log — no keyboard thrash. The
 * caret sits in whichever cell is focused; Next hops to the following field,
 * Done closes. Presentational: the parent owns the draft. */
export function KeyPad({
  caption,
  draft,
  nextLabel,
  onDigit,
  onBackspace,
  onNext,
  onClose,
}: {
  caption: string;
  draft: string;
  nextLabel: string;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <Animated.View
      entering={SlideInDown.springify().stiffness(320).damping(30)}
      exiting={SlideOutDown.duration(160)}
      style={[styles.pad, { backgroundColor: colors.surface, borderTopColor: alpha(colors.rule, 0.6) }]}
    >
      <View style={styles.captionRow}>
        <Text numberOfLines={1} style={[styles.caption, type.sansMedium, { color: colors.inkMuted }]}>
          {caption}
        </Text>
        <Text style={[styles.draft, type.sansSemiBold, { color: colors.ink }]}>{draft || "—"}</Text>
        <PressableScale
          scaleTo={0.9}
          accessibilityLabel="Close keypad"
          onPress={onClose}
          style={[styles.doneBtn, { backgroundColor: alpha(colors.ink, 0.06) }]}
        >
          <Text style={[styles.doneText, type.sansMedium, { color: colors.inkMuted }]}>Done</Text>
        </PressableScale>
      </View>

      <View style={styles.keys}>
        {KEYS.map((k) => (
          <Key key={k} label={k} onPress={() => onDigit(k)} />
        ))}
        <Key label="del" onPress={onBackspace} icon={<Delete size={18} color={colors.ink} />} />
      </View>

      <PressableScale
        scaleTo={0.98}
        accessibilityLabel={nextLabel}
        onPress={onNext}
        style={[styles.next, { backgroundColor: colors.ink }]}
      >
        <Text style={[styles.nextText, type.sansSemiBold, { color: colors.paper }]}>{nextLabel}</Text>
      </PressableScale>
    </Animated.View>
  );
}

function Key({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: pressed ? alpha(colors.ink, 0.1) : alpha(colors.ink, 0.04) },
      ]}
    >
      {icon ?? <Text style={[styles.keyText, type.sansSemiBold, { color: colors.ink }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: "#282018",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  caption: {
    flex: 1,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: "capitalize",
  },
  draft: {
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  doneBtn: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  doneText: {
    fontSize: 12.5,
  },
  keys: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  key: {
    width: "31.7%",
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontSize: 20,
    fontVariant: ["tabular-nums"],
  },
  next: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  nextText: {
    fontSize: 14,
    letterSpacing: 0.4,
  },
});
