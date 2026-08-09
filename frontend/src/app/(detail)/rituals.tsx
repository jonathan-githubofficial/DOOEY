import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { RitualsPanel } from "@/features/rituals/components/RitualsPanel";
import { usePagePadding } from "@/lib/shell";
import { usePalette } from "@/stores/theme";

/** The shape of your week.
 *
 * This was a panel inside Preferences, under the gym's pounds-or-kilos, which
 * is where you put a setting and not where you put the thing that decides what
 * every day looks like. It is a drill-in of Today now: you edit the week from
 * the page that draws it. */
export default function Rituals() {
  const colors = usePalette();
  const page = usePagePadding();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      <View style={styles.headRow}>
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back to Today"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.inkMuted} />
        </PressableScale>
        <Masthead title="Rituals" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: page.paddingBottom }]}
      >
        <RitualsPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  headRow: { paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 2 },
  back: { height: 40, width: 36, alignItems: "center", justifyContent: "center" },
});
