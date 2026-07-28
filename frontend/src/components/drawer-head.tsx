import { Check, X } from "lucide-react-native";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow } from "@/components/surface";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The two corners every drawer keeps: back out on the left, commit on the
 * right.
 *
 * One convention, no labels. Drawers used to disagree — the composer put
 * "Cancel" and "Add task" in a footer, the scheduling sheet put "Cancel" as
 * text beside a tick, the program deck put its ✕ on the *right* where the tick
 * belongs — so the same two decisions lived somewhere different on every
 * surface. Words also date badly here: "Add task", "Create program", "Save
 * doodle" and "Add 3 exercises" are four ways of saying the one thing the tick
 * already says.
 *
 * A drawer that commits nothing (a browser you only ever close) passes no
 * `onConfirm` and gets the left corner alone. The right stays empty rather than
 * being reused, so the tick never has to be looked for. */
export function DrawerHead({
  eyebrow,
  title,
  center,
  onCancel,
  cancelLabel = "Cancel",
  onConfirm,
  confirmLabel = "Done",
  confirmDisabled,
  trailing,
  accent,
  style,
}: {
  /** The tracked micro-label, left-aligned beside the ✕. */
  eyebrow?: string;
  /** A display title instead, centred between the two corners. */
  title?: string;
  /** Or a control of your own in the middle — a drawer with two modes puts
   * its tabs here, where the title would be. */
  center?: React.ReactNode;
  onCancel: () => void;
  cancelLabel?: string;
  /** Omit to leave the right corner empty. */
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** One content action in the right corner, for a drawer that commits
   * nothing — a browser's "New program". Ignored when `onConfirm` is set: the
   * corner is the tick's before it is anything else's. */
  trailing?: React.ReactNode;
  /** The tick's fill. Defaults to zest, the app's affirmative. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = usePalette();
  const type = useType();
  const fill = accent ?? colors.zest;

  return (
    <View style={[styles.head, style]}>
      <PressableScale
        scaleTo={0.85}
        accessibilityLabel={cancelLabel}
        onPress={() => {
          hapticTap();
          onCancel();
        }}
        style={[styles.disc, { backgroundColor: alpha(colors.ink, 0.06) }]}
      >
        <X size={17} color={colors.inkMuted} strokeWidth={2.4} />
      </PressableScale>

      {center ? (
        <View style={styles.centerSlot}>{center}</View>
      ) : title ? (
        <Text numberOfLines={1} style={[styles.title, type.display, { color: colors.ink }]}>
          {title}
        </Text>
      ) : (
        <View style={styles.eyebrowSlot}>{!!eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}</View>
      )}

      {onConfirm ? (
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled: !!confirmDisabled }}
          disabled={confirmDisabled}
          onPress={onConfirm}
          style={[styles.disc, { backgroundColor: fill }, confirmDisabled && styles.off]}
        >
          <Check size={17} color={colors.paper} strokeWidth={3} />
        </PressableScale>
      ) : (
        // Holds the title centred, and holds the corner open so nothing else
        // creeps into it.
        (trailing ?? <View style={styles.disc} />)
      )}
    </View>
  );
}

/** The disc size, exported so a drawer can reserve the same gutter when it
 * scrolls its own content under the head. */
export const DRAWER_HEAD_H = 36;

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  disc: {
    height: DRAWER_HEAD_H,
    width: DRAWER_HEAD_H,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  off: { opacity: 0.35 },
  eyebrowSlot: { flex: 1, minWidth: 0 },
  centerSlot: { flex: 1, minWidth: 0, alignItems: "center" },
  title: { flex: 1, minWidth: 0, textAlign: "center", fontSize: 18, letterSpacing: -0.3 },
});
