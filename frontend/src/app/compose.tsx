import { Redirect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useEffect } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { ComposerForm } from "@/features/tasks/components/TaskComposer";
import { localDate } from "@/lib/dates";
import { useAuthStore } from "@/stores/auth";

// ── TUNING KNOBS ────────────────────────────────────────────────────────────
// Sheet heights as fractions of the screen: [resting, dragged-up].
// WITH the keyboard up, the keyboard's own height stacks on top — so this
// pair stays small…
const DETENTS_KEYBOARD = [0.15, 0.2];
// …and once the keyboard is dismissed the sheet switches to this pair, or it
// would slump to 15% of the screen.
const DETENTS_BARE = [0.5, 0.85];

/** The new-task form, presented by the system as a native form sheet (see the
 * root layout's screen options) — the OS owns the slide-up, the grabber, the
 * corner radius and keeping the fields above the keyboard. */
export default function Compose() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { date, start } = useLocalSearchParams<{ date?: string; start?: string }>();

  // The sheet's height follows the keyboard: small detents while typing
  // (the keyboard carries the sheet up), taller ones when it's dismissed.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () =>
      navigation.setOptions({ sheetAllowedDetents: DETENTS_KEYBOARD }),
    );
    const hide = Keyboard.addListener(hideEvt, () =>
      navigation.setOptions({ sheetAllowedDetents: DETENTS_BARE }),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [navigation]);

  if (!isAuthenticated) return <Redirect href="/login" />;
  // On the web the composer lives at /compose; a page reload would land on a
  // contextless sheet with nothing behind it. If there's no history to close
  // back into, send them home instead.
  if (Platform.OS === "web" && !router.canGoBack()) return <Redirect href="/" />;

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom) }]}>
      <Grain radius={24} />
      <ComposerForm
        fill
        date={date ?? localDate()}
        initialStart={start ? Number(start) : undefined}
        onDone={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // flex: 1 — the form (grain and all) reaches the sheet's bottom edge, with
  // the footer anchored down there.
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
