import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInDown,
  withTiming,
  type EntryExitAnimationFunction,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow } from "@/components/surface";
import { useCardRadius, useShadow } from "@/features/style/store";
import { hapticTap } from "@/lib/haptics";
import { dur, ease, settle, timing } from "@/lib/motion";
import { SHEET_OVERHANG } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import {
  closeSheet,
  useSheetStore,
  type Anchor,
  type SheetAction,
  type SheetSpec,
} from "@/stores/sheet";
import { useElevation, usePalette, useType } from "@/stores/theme";

const WEB = Platform.OS === "web";

/** Geometry of the popped menu. A fixed row height means it can be placed
 * before it is drawn, so it never flashes in the wrong corner first. */
const MENU_W = 224;
const MENU_ROW_H = 44;
const MENU_PAD = 6;
const MENU_GAP = 6;
const EDGE = 10;

/** The menu unfolds out of the ⋯ rather than arriving over it: it starts small
 * at the button and opens, with `transformOrigin` pinned to the corner the
 * button sits at. A timing curve, not a spring — no finger is driving this. */
const unfold: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.9 }] },
    animations: {
      opacity: withTiming(1, timing(dur.instant, ease.out)),
      transform: [{ scale: withTiming(1, timing(dur.quick, ease.out)) }],
    },
  };
};

/** Whatever the app has to say from outside the page, mounted once above the
 * navigator. A ⋯ menu pops out of the button that was pressed, on every
 * platform. Everything else — a prompt, a confirm the web has to draw itself —
 * rises from the bottom on a phone and sits centred on a wide screen. */
export function SheetHost() {
  const spec = useSheetStore((s) => s.spec);
  const seq = useSheetStore((s) => s.seq);

  const anchor = spec?.kind === "actions" ? spec.anchor : undefined;
  return (
    <Modal
      visible={!!spec}
      transparent
      animationType="none"
      // Android measures in window coordinates that include the status bar, so
      // the modal has to cover it too or every menu lands that much too low.
      statusBarTranslucent
      onRequestClose={closeSheet}
    >
      {spec &&
        (anchor && spec.kind === "actions" ? (
          <Popover actions={spec.actions} anchor={anchor} />
        ) : (
          <Sheet spec={spec} seq={seq} />
        ))}
    </Modal>
  );
}

/** The menu itself: a small card at the ⋯ that opened it, dismissed by pressing
 * away. It carries no title — the button it hangs off already says what it
 * belongs to. */
function Popover({ actions, anchor }: { actions: SheetAction[]; anchor: Anchor }) {
  const colors = usePalette();
  const shadow = useShadow();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const height = actions.length * MENU_ROW_H + MENU_PAD * 2;
  // Hang from the button's right edge, then pull back inside the screen.
  const right = anchor.x + anchor.width - MENU_W;
  const left = Math.min(Math.max(right, EDGE), Math.max(EDGE, winW - MENU_W - EDGE));
  const below = anchor.y + anchor.height + MENU_GAP;
  const floor = winH - insets.bottom - EDGE;
  // Flip above the button when there isn't room under it.
  const flipped = below + height > floor;
  const top = flipped ? Math.max(insets.top + EDGE, anchor.y - height - MENU_GAP) : below;
  // Grow from wherever the button actually is along the menu's edge, so a menu
  // pulled back from the screen edge still unfolds out of its own ⋯.
  const originX = Math.min(Math.max(anchor.x + anchor.width / 2 - left, 0), MENU_W);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityLabel="Dismiss"
        style={StyleSheet.absoluteFill}
        onPress={closeSheet}
      />
      <Animated.View
        entering={unfold}
        style={[
          styles.menu,
          {
            left,
            top,
            transformOrigin: [originX, flipped ? height : 0, 0],
            backgroundColor: colors.surface,
            borderColor: alpha(colors.rule, 0.7),
            shadowColor: colors.ink,
            shadowOpacity: 0.12 * shadow,
            elevation: Math.round(4 * shadow),
          },
        ]}
      >
        {actions.map((a) => (
          <Choice key={a.label} action={a} compact />
        ))}
      </Animated.View>
    </View>
  );
}

/** Android's bottom sheet, and the web's centred card for everything that has
 * no ⋯ to hang off: a confirm, a prompt. */
function Sheet({ spec, seq }: { spec: SheetSpec; seq: number }) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const radius = useCardRadius();
  const elevation = useElevation("lifted");
  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      style={[
        styles.backdrop,
        WEB && styles.backdropCentred,
        { backgroundColor: alpha(colors.ink, 0.35) },
      ]}
    >
      <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={closeSheet} />
      <Animated.View
        // It slides up and stops. A sheet is not attached to your finger, so
        // it gets a timing curve like everything else that merely explains a
        // change.
        entering={
          WEB ? FadeIn.duration(dur.quick) : SlideInDown.duration(dur.moved).easing(ease.out)
        }
        layout={settle()}
        style={[
          WEB ? styles.card : styles.sheet,
          WEB && elevation,
          {
            backgroundColor: colors.surface,
            borderColor: alpha(colors.rule, 0.7),
            // The web card floats and is rounded all round, so it has no
            // edge to hide; only the native drawer runs on under the keyboard.
            paddingBottom: WEB ? 18 : insets.bottom + 12 + SHEET_OVERHANG,
            marginBottom: WEB ? 0 : -SHEET_OVERHANG,
            ...(WEB
              ? { borderRadius: radius }
              : { borderTopLeftRadius: radius, borderTopRightRadius: radius }),
          },
        ]}
      >
        {!WEB && <View style={[styles.grabber, { backgroundColor: alpha(colors.inkMuted, 0.3) }]} />}
        <Animated.View key={seq} entering={FadeIn.duration(160)}>
          {spec.kind === "actions" ? <Choices spec={spec} /> : <Field spec={spec} />}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** A titled stack of choices, with Cancel set apart underneath. */
function Choices({ spec }: { spec: Extract<SheetSpec, { kind: "actions" }> }) {
  const colors = usePalette();
  const type = useType();
  return (
    <>
      {spec.title && (
        <View style={styles.head}>
          <Text style={[styles.title, type.display, { color: colors.ink }]}>{spec.title}</Text>
          {spec.message && (
            <Text style={[styles.message, type.sans, { color: colors.inkMuted }]}>
              {spec.message}
            </Text>
          )}
        </View>
      )}
      {spec.actions.map((a, i) => (
        <Choice key={a.label} action={a} divided={i > 0} />
      ))}
      <PressableScale
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={() => {
          hapticTap();
          closeSheet();
        }}
        style={[styles.cancel, { borderColor: alpha(colors.rule, 0.7) }]}
      >
        <Text style={[styles.cancelLabel, type.sansMedium, { color: colors.inkMuted }]}>
          Cancel
        </Text>
      </PressableScale>
    </>
  );
}

function Choice({
  action,
  divided,
  compact,
}: {
  action: SheetAction;
  divided?: boolean;
  compact?: boolean;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => {
        hapticTap();
        // An action is allowed to open the next sheet (a delete asking to be
        // confirmed). Only close if it didn't: the surface then stays put and
        // swaps its contents, instead of dropping away and flying back up.
        const before = useSheetStore.getState().seq;
        action.onPress();
        if (useSheetStore.getState().seq === before) closeSheet();
      }}
      style={[
        compact ? styles.menuRow : styles.action,
        divided && { borderTopWidth: 1, borderTopColor: alpha(colors.rule, 0.5) },
      ]}
    >
      {action.icon}
      <Text
        style={[
          compact ? styles.menuLabel : styles.actionLabel,
          type.sansMedium,
          { color: action.destructive ? colors.clay : colors.ink },
        ]}
      >
        {action.label}
      </Text>
    </PressableScale>
  );
}

/** One field. Remounted per open, so it seeds from `initial` without a reset
 * dance. Confirm on the plate or the return key; an empty value is ignored. */
function Field({ spec }: { spec: Extract<SheetSpec, { kind: "prompt" }> }) {
  const colors = usePalette();
  const type = useType();
  const [text, setText] = useState(spec.initial ?? "");
  const submit = () => {
    const v = text.trim();
    if (!v) return;
    closeSheet();
    spec.onSubmit(v);
  };
  return (
    <>
      <Eyebrow>{spec.title}</Eyebrow>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={spec.placeholder}
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        style={[
          styles.input,
          type.display,
          { color: colors.ink, borderBottomColor: alpha(colors.ink, 0.18) },
        ]}
      />
      <Plate label={spec.confirmLabel} onPress={submit} style={styles.confirm} />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  backdropCentred: { justifyContent: "center", alignItems: "center", padding: 24 },
  sheet: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  grabber: { alignSelf: "center", height: 4, width: 40, borderRadius: 999, marginBottom: 8 },
  head: { paddingTop: 4, paddingBottom: 12 },
  title: { fontSize: 18, letterSpacing: -0.3 },
  message: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  action: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16 },
  actionLabel: { fontSize: 15.5 },
  cancel: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelLabel: { fontSize: 14.5 },
  menu: {
    position: "absolute",
    width: MENU_W,
    borderRadius: 14,
    borderWidth: 1,
    padding: MENU_PAD,
  },
  menuRow: {
    height: MENU_ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuLabel: { fontSize: 14.5 },
  input: {
    marginTop: 10,
    borderBottomWidth: 1,
    paddingVertical: 8,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  confirm: { marginTop: 18, alignSelf: "stretch", borderRadius: 14, paddingVertical: 15 },
});
