import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { ComposerForm } from "@/features/tasks/components/TaskComposer";
import { localDate } from "@/lib/dates";
import { useAuthStore } from "@/stores/auth";

/** The new-task form, presented by the system as a native form sheet (see the
 * root layout's screen options) — the OS owns the slide-up, the grabber, the
 * corner radius and keeping the fields above the keyboard. */
export default function Compose() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { date, start } = useLocalSearchParams<{ date?: string; start?: string }>();
  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    // The sheet hugs its content — a big bottom pad reads as dead space.
    <View style={[styles.sheet, { paddingBottom: Math.max(12, insets.bottom) }]}>
      <Grain radius={24} />
      <ComposerForm
        date={date ?? localDate()}
        initialStart={start ? Number(start) : undefined}
        onDone={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // No flex: the sheet's "fitToContents" detent sizes itself to this view.
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
