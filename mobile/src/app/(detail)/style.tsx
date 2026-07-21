import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { StyleStudio } from "@/features/style/components/StyleStudio";
import { usePalette } from "@/stores/theme";

/** The Style studio page — a drill-in of Account, with the dock underfoot. */
export default function Style() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
      >
        <View style={styles.headRow}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Back to Account"
            onPress={() => router.back()}
            style={styles.back}
          >
            <ChevronLeft size={22} color={colors.inkMuted} />
          </PressableScale>
          <Masthead title="Style studio" />
        </View>
        <View style={styles.studio}>
          <StyleStudio />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  back: {
    height: 40,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  studio: {
    marginTop: 20,
  },
});
