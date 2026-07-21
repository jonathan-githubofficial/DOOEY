import { ChevronLeft, RotateCcw } from "lucide-react-native";
import { Redirect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { useStyleStore } from "@/features/style/store";
import { GRAINS, PRESETS, RADII } from "@/features/style/tokens";
import { alpha, fonts, palettes } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore } from "@/stores/theme";

/** The Style page — the mobile take on the web's Style studio: one-tap
 * palettes, corners and grain. The whole app restyles live as you tap. */
export default function Style() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const theme = useThemeStore((s) => s.theme);
  const { preset, radius, grain, setPreset, setRadius, setGrain, resetAll } = useStyleStore();

  if (!isAuthenticated) return <Redirect href="/login" />;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <View style={styles.head}>
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.inkMuted} />
        </PressableScale>
        <Text style={[styles.title, { color: colors.ink }]}>Style studio</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Panel style={styles.panel}>
          <Eyebrow>palette</Eyebrow>
          <View style={styles.swatchRow}>
            {PRESETS.map((p) => {
              const sample = { ...palettes[theme], ...p.colors[theme] };
              const active = p.key === preset;
              return (
                <PressableScale
                  key={p.key}
                  accessibilityLabel={`${p.label} palette`}
                  onPress={() => setPreset(p.key)}
                  style={[
                    styles.swatch,
                    { backgroundColor: sample.paper, borderColor: alpha(colors.rule, 0.7) },
                    active && { borderColor: colors.zest, borderWidth: 2 },
                  ]}
                >
                  <View style={styles.swatchDots}>
                    <View style={[styles.swatchDot, { backgroundColor: sample.ink }]} />
                    <View style={[styles.swatchDot, { backgroundColor: sample.zest }]} />
                  </View>
                  <Text style={[styles.swatchLabel, { color: sample.ink }]}>{p.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          <Eyebrow style={styles.sectionLabel}>corners</Eyebrow>
          <View style={styles.chipRow}>
            {RADII.map((r) => (
              <Chip
                key={r.key}
                label={r.label}
                active={radius === r.value}
                onPress={() => setRadius(r.value)}
                preview={<View style={[styles.cornerPreview, { borderColor: colors.ink, borderTopLeftRadius: r.value / 2.5 }]} />}
              />
            ))}
          </View>

          <Eyebrow style={styles.sectionLabel}>grain</Eyebrow>
          <View style={styles.chipRow}>
            {GRAINS.map((g) => (
              <Chip
                key={g.key}
                label={g.label}
                active={grain === g.value}
                onPress={() => setGrain(g.value)}
              />
            ))}
          </View>

          <PressableScale onPress={resetAll} style={styles.reset}>
            <RotateCcw size={14} color={colors.inkMuted} />
            <Text style={[styles.resetLabel, { color: colors.inkMuted }]}>Back to factory</Text>
          </PressableScale>
        </Panel>
      </ScrollView>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  preview,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  preview?: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: alpha(colors.rule, 0.7), backgroundColor: colors.paper },
        active && { borderColor: colors.zest, backgroundColor: alpha(colors.zest, 0.12) },
      ]}
    >
      {preview}
      <Text
        style={[styles.chipLabel, { color: active ? colors.zest : colors.inkMuted }]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  back: {
    height: 40,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 30,
    letterSpacing: -0.7,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },
  panel: {
    padding: 24,
  },
  swatchRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  swatch: {
    width: 88,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  swatchDots: {
    flexDirection: "row",
    gap: 4,
  },
  swatchDot: {
    height: 10,
    width: 10,
    borderRadius: 999,
  },
  swatchLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
  },
  sectionLabel: {
    marginTop: 28,
  },
  chipRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  cornerPreview: {
    height: 14,
    width: 14,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  reset: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  resetLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
});
