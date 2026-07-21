import { Redirect, useRouter } from "expo-router";
import { Moon, Sun } from "lucide-react-native";
import type { RecordModel } from "pocketbase";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleEditor } from "@/components/DoodleEditor";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { useStyleStore } from "@/features/style/store";
import { BACKDROPS, fontStyle } from "@/features/style/tokens";
import type { Stroke } from "@/lib/doodle";
import { hapticSuccess, hapticTap } from "@/lib/haptics";
import { pb } from "@/lib/pb";
import { alpha, type Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore, useType } from "@/stores/theme";

const ROOMS = ["THE REGISTER", "SELF-PORTRAIT", "THE LIGHT"] as const;
const NUMERALS = ["I", "II", "III"];

/** The private view: three small rooms a new member walks through — leave a
 * name, hang a self-portrait, set the light. Every stop is skippable; all of
 * it can be re-hung later in the Style studio. */
export default function Onboarding() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");

  if (!user) return <Redirect href="/login" />;

  const advance = () => {
    hapticTap();
    setStep((s) => s + 1);
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed) {
      // The name is a nicety, not a gate — a failed save must not stall the
      // tour, and the input stays editable from Account later.
      try {
        const rec = await pb
          .collection("users")
          .update(user.id, { name: trimmed }, { requestKey: null });
        useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token);
      } catch {
        // Offline or flaky boot — the tour goes on without the name.
      }
    }
    advance();
  };

  const finish = () => {
    hapticSuccess();
    router.replace("/");
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      <Grain />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[
          styles.center,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {/* Room markers — three brass dots along the corridor. */}
        <View style={styles.dots}>
          {ROOMS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === step ? colors.zest : alpha(colors.ink, 0.18) },
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Animated.View
          key={step}
          entering={FadeInDown.springify().stiffness(220).damping(24)}
          style={styles.room}
        >
          <Text style={[styles.eyebrow, type.sansMedium, { color: colors.inkMuted }]}>
            ROOM {NUMERALS[step]} · {ROOMS[step]}
          </Text>

          {step === 0 && (
            <>
              <Text style={[styles.title, fontStyle("fraunces", "900"), { color: colors.ink }]}>
                Sign the register.
              </Text>
              <Text style={[styles.body, type.sans, { color: colors.inkMuted }]}>
                Every visitor leaves a name. What should DOOEY call you?
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onSubmitEditing={saveName}
                placeholder="Your name"
                placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                autoComplete="name"
                textContentType="name"
                returnKeyType="done"
                style={[
                  styles.input,
                  type.sans,
                  { color: colors.ink, borderBottomColor: alpha(colors.ink, 0.18) },
                ]}
              />
              <View style={styles.footer}>
                <Plate label="Continue" onPress={saveName} />
                <SkipLink onPress={advance} />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={[styles.title, fontStyle("fraunces", "900"), { color: colors.ink }]}>
                Hang a self-portrait.
              </Text>
              <Text style={[styles.body, type.sans, { color: colors.inkMuted }]}>
                No photographs in this gallery — a quick doodle takes your place.
              </Text>
              <View style={styles.easel}>
                <DoodleEditor
                  heading="self-portrait"
                  initial={(user.avatar_doodle as Stroke[] | null) ?? []}
                  onClose={advance}
                  onSave={async (strokes) => {
                    const rec = await pb
                      .collection("users")
                      .update(user.id, { avatar_doodle: strokes }, { requestKey: null });
                    useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token);
                    advance();
                  }}
                />
              </View>
              <View style={styles.footer}>
                <SkipLink label="Skip — hang it later" onPress={advance} />
              </View>
            </>
          )}

          {step === 2 && <LightRoom onDone={finish} />}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Room III: pick day or evening, and an optional wash for the walls — both
 * apply live, so the room itself is the preview. */
function LightRoom({ onDone }: { onDone: () => void }) {
  const colors = usePalette();
  const type = useType();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.set);
  const backdrop = useStyleStore((s) => s.backdrop);
  const setBackdrop = useStyleStore((s) => s.setBackdrop);

  return (
    <>
      <Text style={[styles.title, fontStyle("fraunces", "900"), { color: colors.ink }]}>
        Set the light.
      </Text>
      <Text style={[styles.body, type.sans, { color: colors.inkMuted }]}>
        Day or evening, and a wash for the walls. Re-hang any of it later in the Style studio.
      </Text>

      <View style={styles.lightRow}>
        {(["light", "dark"] as const).map((t) => {
          const active = theme === t;
          return (
            <PressableScale
              key={t}
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityLabel={t === "light" ? "Day light" : "Evening light"}
              onPress={() => {
                hapticTap();
                setTheme(t);
              }}
              style={[
                styles.lightCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: active ? colors.zest : alpha(colors.rule, 0.7),
                },
              ]}
            >
              {t === "light" ? (
                <Sun size={18} color={active ? colors.zest : colors.inkMuted} />
              ) : (
                <Moon size={18} color={active ? colors.zest : colors.inkMuted} />
              )}
              <Text
                style={[
                  type.sansMedium,
                  styles.lightLabel,
                  { color: active ? colors.ink : colors.inkMuted },
                ]}
              >
                {t === "light" ? "Day" : "Evening"}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.washRow}>
        <WashSwatch
          selected={backdrop === null}
          label="Bare walls"
          onPress={() => setBackdrop(null)}
        >
          <View style={[styles.washBare, { borderColor: alpha(colors.ink, 0.25) }]} />
        </WashSwatch>
        {BACKDROPS.map((b) => (
          <WashSwatch
            key={b.key}
            selected={backdrop === b.key}
            label={`${b.label} wash`}
            onPress={() => setBackdrop(b.key)}
          >
            <View style={styles.washPair}>
              <View style={{ flex: 1, backgroundColor: colors[b.from as keyof Palette] }} />
              <View style={{ flex: 1, backgroundColor: colors[b.to as keyof Palette] }} />
            </View>
          </WashSwatch>
        ))}
      </View>

      <View style={styles.footer}>
        <Plate label="Enter the gallery" onPress={onDone} />
      </View>
    </>
  );
}

function WashSwatch({
  selected,
  label,
  onPress,
  children,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      scaleTo={0.88}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={[
        styles.swatch,
        { borderColor: selected ? colors.zest : "transparent" },
      ]}
    >
      {children}
    </PressableScale>
  );
}

function SkipLink({ label = "Skip for now", onPress }: { label?: string; onPress: () => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.skip, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 999,
  },
  dotActive: {
    width: 20,
  },
  room: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 9.5,
    letterSpacing: 2.6,
  },
  title: {
    marginTop: 12,
    fontSize: 30,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  body: {
    marginTop: 10,
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 300,
  },
  input: {
    marginTop: 26,
    alignSelf: "stretch",
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 2,
    fontSize: 17,
    textAlign: "center",
  },
  easel: {
    marginTop: 22,
  },
  footer: {
    marginTop: 26,
    alignItems: "center",
    gap: 16,
  },
  skip: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  lightRow: {
    marginTop: 24,
    flexDirection: "row",
    gap: 12,
  },
  lightCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  lightLabel: {
    fontSize: 13,
  },
  washRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  swatch: {
    height: 34,
    width: 34,
    borderRadius: 999,
    borderWidth: 2,
    padding: 2,
  },
  washPair: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
    flexDirection: "row",
  },
  washBare: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
  },
});
