import { useRouter } from "expo-router";
import { ChevronLeft, Dumbbell } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { formatRest, useWorkoutPrefs, type WeightUnit } from "@/features/workouts/store";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** App preferences — a drill-in of Account. Today it holds the Gym banner;
 * other spaces can hang their settings here later. */
export default function Preferences() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
          <Masthead title="Preferences" />
        </View>

        <GymPrefs />
      </ScrollView>
    </View>
  );
}

/** The Gym banner — everything the gym used to carry in its own workspace. */
function GymPrefs() {
  const colors = usePalette();
  const type = useType();
  const unit = useWorkoutPrefs((s) => s.unit);
  const setUnit = useWorkoutPrefs((s) => s.setUnit);
  const restSeconds = useWorkoutPrefs((s) => s.restSeconds);
  const setRestSeconds = useWorkoutPrefs((s) => s.setRestSeconds);
  const autoStartRest = useWorkoutPrefs((s) => s.autoStartRest);
  const setAutoStartRest = useWorkoutPrefs((s) => s.setAutoStartRest);
  const restDoneBuzz = useWorkoutPrefs((s) => s.restDoneBuzz);
  const setRestDoneBuzz = useWorkoutPrefs((s) => s.setRestDoneBuzz);

  return (
    <>
      <View style={styles.banner}>
        <View style={[styles.bannerIcon, { backgroundColor: alpha(colors.zest, 0.15) }]}>
          <Dumbbell size={20} color={colors.zest} />
        </View>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, type.display, { color: colors.ink }]}>Gym</Text>
          <Text style={[styles.bannerSub, type.sans, { color: colors.inkMuted }]}>
            Units, rest timer and how it behaves between sets.
          </Text>
        </View>
      </View>

      <Panel style={styles.panel}>
        {/* Units */}
        <Row label="Units" hint="How weights are shown and entered.">
          <Segmented
            options={["lbs", "kg"] as WeightUnit[]}
            value={unit}
            onChange={(u) => {
              hapticTap();
              setUnit(u);
            }}
          />
        </Row>

        <Divider />

        {/* Default rest — the value a new exercise starts with. */}
        <Row label="Default rest" hint="New exercises start with this rest.">
          <Stepper
            value={restSeconds}
            display={formatRest(restSeconds)}
            step={15}
            min={15}
            onChange={setRestSeconds}
          />
        </Row>

        <Divider />

        <Row label="Auto-start rest" hint="Start the countdown when a set is done.">
          <Switch
            value={autoStartRest}
            onValueChange={(v) => {
              hapticTap();
              setAutoStartRest(v);
            }}
            trackColor={{ true: colors.zest, false: alpha(colors.ink, 0.15) }}
            thumbColor={colors.surface}
          />
        </Row>

        <Divider />

        <Row label="Buzz when rest ends" hint="A haptic nudge at zero.">
          <Switch
            value={restDoneBuzz}
            onValueChange={(v) => {
              hapticTap();
              setRestDoneBuzz(v);
            }}
            trackColor={{ true: colors.zest, false: alpha(colors.ink, 0.15) }}
            thumbColor={colors.surface}
          />
        </Row>
      </Panel>
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, type.sansMedium, { color: colors.ink }]}>{label}</Text>
        <Text style={[styles.rowHint, type.sans, { color: colors.inkMuted }]}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

function Divider() {
  const colors = usePalette();
  return <View style={[styles.divider, { backgroundColor: alpha(colors.rule, 0.5) }]} />;
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: WeightUnit[];
  value: WeightUnit;
  onChange: (v: WeightUnit) => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={[styles.segmented, { backgroundColor: alpha(colors.ink, 0.06) }]}>
      {options.map((o) => {
        const active = o === value;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityLabel={o}
            onPress={() => onChange(o)}
            style={[styles.segment, active && { backgroundColor: colors.surface }]}
          >
            <Text
              style={[
                styles.segmentText,
                type.sansMedium,
                { color: active ? colors.ink : colors.inkMuted },
              ]}
            >
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({
  value,
  display,
  step,
  min,
  onChange,
}: {
  value: number;
  display: string;
  step: number;
  min: number;
  onChange: (v: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={[styles.stepper, { backgroundColor: alpha(colors.ink, 0.06) }]}>
      <Pressable
        accessibilityLabel="Less rest"
        onPress={() => {
          hapticTap();
          onChange(Math.max(min, value - step));
        }}
        style={styles.stepBtn}
      >
        <Text style={[styles.stepSign, type.sansMedium, { color: colors.inkMuted }]}>−</Text>
      </Pressable>
      <Text style={[styles.stepValue, type.sansSemiBold, { color: colors.ink }]}>{display}</Text>
      <Pressable
        accessibilityLabel="More rest"
        onPress={() => {
          hapticTap();
          onChange(value + step);
        }}
        style={styles.stepBtn}
      >
        <Text style={[styles.stepSign, type.sansMedium, { color: colors.inkMuted }]}>+</Text>
      </Pressable>
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
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerIcon: {
    height: 40,
    width: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 20,
  },
  bannerSub: {
    marginTop: 1,
    fontSize: 12.5,
  },
  panel: {
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14.5,
  },
  rowHint: {
    marginTop: 2,
    fontSize: 12,
  },
  divider: {
    height: 1,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
  },
  stepBtn: {
    height: 36,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSign: {
    fontSize: 17,
  },
  stepValue: {
    minWidth: 44,
    textAlign: "center",
    fontSize: 14.5,
    fontVariant: ["tabular-nums"],
  },
});
