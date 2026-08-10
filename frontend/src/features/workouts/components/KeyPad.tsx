import { Delete } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { useShadow } from "@/features/style/store";
import { hapticTap } from "@/lib/haptics";
import { fall, rise } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"] as const;

/** How wide the key grid is allowed to get. The pad's surface is full-bleed —
 * that is what makes it read as chrome bolted to the bottom edge rather than a
 * card floating near it — but the keys inside it are a thumb's instrument, and
 * a 9 stretched 280pt wide on a tablet or a wide browser window is not one. */
const GRID_W = 380;

/** A docked number pad that stays put while you log — no keyboard thrash. The
 * caret sits in whichever cell is focused; Next hops to the following field,
 * Done closes. Presentational: the parent owns the draft.
 *
 * Built as a keyboard accessory, not as a sheet: it slides straight up on a
 * curve, it is separated from the page by a hairline rather than a drop
 * shadow, and it clears the home indicator. Those three things are the whole
 * difference between this reading as part of the OS and reading as a popup. */
export function KeyPad({
  caption,
  draft,
  nextLabel,
  bumps,
  onBump,
  onDigit,
  onBackspace,
  onNext,
  onClose,
}: {
  caption: string;
  draft: string;
  nextLabel: string;
  bumps?: number[];
  onBump?: (n: number) => void;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const shadow = useShadow();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={rise()}
      exiting={fall()}
      style={[
        styles.pad,
        {
          backgroundColor: colors.surface,
          borderTopColor: alpha(colors.rule, 0.7),
          paddingBottom: Math.max(insets.bottom, 10) + 10,
          // A lifted card casts a shadow because it is floating; docked chrome
          // does not, because it is attached. Just enough to separate the pad
          // from a scroller sliding under it, and it honours the user's own
          // shadow setting like every other surface does.
          shadowColor: colors.ink,
          shadowOpacity: 0.07 * shadow,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: -2 },
          elevation: Math.round(6 * shadow),
        },
      ]}
    >
      <Grain radius={20} />
      <View style={styles.column}>
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

        {bumps && bumps.length > 0 && onBump && (
          <View style={styles.bumps}>
            {bumps.map((b) => (
              <PressableScale
                key={b}
                scaleTo={0.9}
                accessibilityLabel={`Add ${b}`}
                onPress={() => {
                  hapticTap();
                  onBump(b);
                }}
                style={[styles.bump, { backgroundColor: alpha(colors.zest, 0.12) }]}
              >
                <Text style={[styles.bumpText, type.sansSemiBold, { color: colors.zest }]}>+{b}</Text>
              </PressableScale>
            ))}
          </View>
        )}

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
      </View>
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
      // A key highlights, it does not shrink — that is what the OS keyboard
      // does, and this pad sits where the OS keyboard would.
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
    paddingTop: 10,
  },
  column: { width: "100%", maxWidth: GRID_W, alignSelf: "center", paddingHorizontal: 12 },
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
  bumps: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  bump: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
  },
  bumpText: {
    fontSize: 13.5,
    letterSpacing: 0.3,
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
