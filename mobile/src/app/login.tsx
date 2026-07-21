import { Redirect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Eye, EyeOff } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { signIn, signUp } from "@/features/auth/api";
import { fontStyle } from "@/features/style/tokens";
import { hapticSuccess, hapticTap, hapticWarn } from "@/lib/haptics";
import { alpha, type Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(400).damping(32);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function strengthOf(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw))) s++;
  return { score: Math.min(3, s), label: ["too short", "fair", "good", "strong"][Math.min(3, s)] };
}

/** The front door as a gallery wall: the wordmark hangs as a matted, framed
 * piece under a soft picture-light, with engraved labels, thin ruled fields
 * and a cast-metal plate to enter. */
export default function Login() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dark = useThemeStore((s) => s.theme) === "dark";
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => strengthOf(password), [password]);

  if (isAuthenticated) return <Redirect href="/" />;

  const emailOk = EMAIL_RE.test(email.trim());
  const pwOk = password.length >= 8;
  const confirmOk = mode === "in" || confirm === password;
  const canSubmit = !busy && emailOk && pwOk && confirmOk;

  const swap = () => {
    hapticTap();
    setMode((m) => (m === "in" ? "up" : "in"));
    setError(null);
    setConfirm("");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      hapticSuccess();
      router.replace("/");
    } catch (e) {
      hapticWarn();
      setError(friendlyError(e, mode));
      setBusy(false);
    }
  };

  const bevelLight = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.75)";
  const bevelDark = alpha(colors.ink, dark ? 0.4 : 0.14);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      <Grain />
      {/* The picture-light: a soft wash spilling from above onto the wall. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(dark ? "#ffffff" : "#ffffff", dark ? 0.05 : 0.22), "transparent"]}
        style={[StyleSheet.absoluteFill, { height: "55%" }]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      >
        <Animated.View
          entering={FadeInDown.springify().stiffness(200).damping(23)}
          style={styles.hang}
        >
          {/* The frame moulding. */}
          <View
            style={[
              styles.frame,
              { backgroundColor: colors.surface, borderColor: alpha(colors.ink, 0.55), shadowColor: "#282018" },
            ]}
          >
            {/* The mat, with a bevelled window cut into it. */}
            <View style={[styles.mat, { backgroundColor: colors.surface }]}>
              <Grain radius={4} />
              <View
                style={[
                  styles.window,
                  {
                    backgroundColor: colors.paper,
                    borderTopColor: bevelLight,
                    borderLeftColor: bevelLight,
                    borderRightColor: bevelDark,
                    borderBottomColor: bevelDark,
                  },
                ]}
              >
                <Grain radius={2} />

                {/* The exhibited piece. */}
                <Text style={[styles.accession, type.sansMedium, { color: colors.inkMuted }]}>
                  {mode === "in" ? "NO. 001 · ADMISSION" : "NO. 001 · ACQUISITION"}
                </Text>
                <Text style={[styles.wordmark, fontStyle("fraunces", "900"), { color: colors.ink }]}>
                  DOOEY<Text style={{ color: colors.zest }}>.</Text>
                </Text>
                <View style={[styles.hairline, { backgroundColor: alpha(colors.ink, 0.2) }]} />
                <Text style={[styles.medium, type.sans, { color: colors.inkMuted }]}>
                  a personal life OS · mixed media on paper
                </Text>

                <View style={styles.fields}>
                  <Field label="Email">
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      style={[styles.input, type.sans, underline(colors), { color: colors.ink }]}
                    />
                  </Field>

                  <Field label="Password">
                    <View style={styles.pwRow}>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        onSubmitEditing={submit}
                        placeholder="••••••••"
                        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                        secureTextEntry={!reveal}
                        autoCapitalize="none"
                        autoComplete={mode === "in" ? "current-password" : "new-password"}
                        textContentType={mode === "in" ? "password" : "newPassword"}
                        style={[styles.input, styles.flex, type.sans, underline(colors), { color: colors.ink }]}
                      />
                      <Pressable
                        accessibilityLabel={reveal ? "Hide password" : "Show password"}
                        hitSlop={8}
                        onPress={() => setReveal((r) => !r)}
                        style={styles.eye}
                      >
                        {reveal ? (
                          <EyeOff size={17} color={colors.inkMuted} />
                        ) : (
                          <Eye size={17} color={colors.inkMuted} />
                        )}
                      </Pressable>
                    </View>
                    {mode === "up" && password.length > 0 && (
                      <Animated.View entering={FadeIn.duration(160)} style={styles.strengthRow}>
                        <View style={[styles.strengthTrack, { backgroundColor: alpha(colors.ink, 0.1) }]}>
                          <View
                            style={[
                              styles.strengthFill,
                              {
                                width: `${(strength.score / 3) * 100}%`,
                                backgroundColor: strength.score >= 3 ? colors.leaf : colors.honey,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.strengthLabel, type.sans, { color: colors.inkMuted }]}>
                          {strength.label}
                        </Text>
                      </Animated.View>
                    )}
                  </Field>

                  {mode === "up" && (
                    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} layout={settle}>
                      <Field label="Confirm">
                        <TextInput
                          value={confirm}
                          onChangeText={setConfirm}
                          onSubmitEditing={submit}
                          placeholder="••••••••"
                          placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                          secureTextEntry={!reveal}
                          autoCapitalize="none"
                          autoComplete="new-password"
                          style={[styles.input, type.sans, underline(colors), { color: colors.ink }]}
                        />
                      </Field>
                    </Animated.View>
                  )}
                </View>

                {error && (
                  <Animated.Text
                    entering={FadeIn.duration(160)}
                    layout={settle}
                    style={[styles.error, type.sans, { color: colors.clay }]}
                  >
                    {error}
                  </Animated.Text>
                )}

                <Animated.View layout={settle} style={styles.plateRow}>
                  <EnterPlate
                    label={busy ? "…" : mode === "in" ? "Enter" : "Register"}
                    disabled={!canSubmit}
                    onPress={submit}
                  />
                </Animated.View>
              </View>
            </View>
          </View>

          {/* The wall label beside the piece — and the way in the other door. */}
          <Pressable onPress={swap} hitSlop={8} style={styles.label}>
            <View style={[styles.labelDot, { backgroundColor: colors.zest }]} />
            <Text style={[styles.labelText, type.sansMedium, { color: colors.inkMuted }]}>
              {mode === "in" ? "First time here? " : "Already a member? "}
              <Text style={{ color: colors.ink }}>
                {mode === "in" ? "Request admission" : "Sign in"}
              </Text>
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** An engraved field: a tracked-caps label over a thin ruled input. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

/** A small cast-metal plaque, engraved — the way in. Top-lit sheen, a pressed
 * emboss, and it sinks on tap. */
function EnterPlate({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.plate, { backgroundColor: colors.ink }, disabled && { opacity: 0.35 }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,255,255,0.18)", "transparent", "rgba(0,0,0,0.22)"]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[styles.plateText, type.sansSemiBold, { color: colors.paper }]}>{label}</Text>
    </PressableScale>
  );
}

function friendlyError(e: unknown, mode: "in" | "up"): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed to authenticate|invalid/i.test(msg) && mode === "in")
    return "That email and password don't match.";
  if (/email.*(taken|exists|unique)/i.test(msg) || /validation_not_unique/i.test(msg))
    return "There's already an account with that email.";
  if (/network|fetch/i.test(msg)) return "Can't reach the server — check your connection.";
  return msg || "Something went wrong. Try again.";
}

function underline(colors: Palette) {
  return { borderBottomColor: alpha(colors.ink, 0.18) };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  hang: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  frame: {
    alignSelf: "stretch",
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 9,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  mat: {
    borderRadius: 3,
    padding: 22,
    overflow: "hidden",
  },
  window: {
    borderWidth: 2,
    borderRadius: 2,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 28,
    overflow: "hidden",
  },
  accession: {
    textAlign: "center",
    fontSize: 9.5,
    letterSpacing: 2.6,
  },
  wordmark: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 40,
    letterSpacing: 1,
  },
  hairline: {
    alignSelf: "center",
    marginTop: 14,
    height: 1,
    width: 44,
  },
  medium: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 12,
    fontStyle: "italic",
  },
  fields: {
    marginTop: 26,
    gap: 18,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    fontSize: 9.5,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  input: {
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    fontSize: 16,
  },
  pwRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
  eye: {
    height: 34,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  strengthTrack: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  strengthFill: {
    height: 3,
    borderRadius: 999,
  },
  strengthLabel: {
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  error: {
    marginTop: 16,
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: "center",
  },
  plateRow: {
    marginTop: 26,
    alignItems: "center",
  },
  plate: {
    minWidth: 150,
    alignItems: "center",
    borderRadius: 5,
    paddingVertical: 13,
    paddingHorizontal: 34,
    overflow: "hidden",
    shadowColor: "#282018",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  plateText: {
    fontSize: 13,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  label: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  labelDot: {
    height: 6,
    width: 6,
    borderRadius: 999,
  },
  labelText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
