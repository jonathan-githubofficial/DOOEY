import { Redirect, useRouter } from "expo-router";
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
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { signIn, signUp } from "@/features/auth/api";
import { fontStyle } from "@/features/style/tokens";
import { hapticSuccess, hapticTap, hapticWarn } from "@/lib/haptics";
import { alpha, type Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(400).damping(32);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Password strength, 0–3: length carries it, variety nudges it. */
function strengthOf(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw))) s++;
  return { score: Math.min(3, s), label: ["too short", "okay", "good", "strong"][Math.min(3, s)] };
}

/** The front door: the wordmark, a segmented sign-in / create-account card
 * with live validation, a password reveal, and a strength read on sign-up. */
export default function Login() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.screen,
        { backgroundColor: colors.paper, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Grain />
      <Text style={[styles.wordmark, fontStyle("fraunces", "900"), { color: colors.ink }]}>
        DOOEY
        <Text style={{ color: colors.zest }}>.</Text>
      </Text>
      <Text style={[styles.tagline, type.sans, { color: colors.inkMuted }]}>
        your day, kept — tasks, habits, and a life you can doodle on.
      </Text>

      <Panel style={styles.card}>
        {/* Segmented mode switch — a raised paper key glides between sides. */}
        <View style={[styles.segment, { backgroundColor: alpha(colors.ink, 0.05) }]}>
          {(["in", "up"] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => mode !== m && swap()}
                style={styles.segmentKey}
              >
                {active && (
                  <Animated.View
                    layout={settle}
                    style={[
                      StyleSheet.absoluteFill,
                      styles.segmentActive,
                      { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.segmentText,
                    type.sansMedium,
                    { color: active ? colors.ink : colors.inkMuted },
                  ]}
                >
                  {m === "in" ? "Sign in" : "Create account"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.heading, type.display, { color: colors.ink }]}>
          {mode === "in" ? "Welcome back." : "Make it yours."}
        </Text>

        <View style={styles.fields}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={alpha(colors.inkMuted, 0.7)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            style={[styles.input, type.sans, inputColors(colors)]}
          />

          <View style={styles.pwWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              placeholder="password"
              placeholderTextColor={alpha(colors.inkMuted, 0.7)}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              textContentType={mode === "in" ? "password" : "newPassword"}
              style={[styles.input, styles.pwInput, type.sans, inputColors(colors)]}
            />
            <Pressable
              accessibilityLabel={reveal ? "Hide password" : "Show password"}
              hitSlop={8}
              onPress={() => setReveal((r) => !r)}
              style={styles.eye}
            >
              {reveal ? (
                <EyeOff size={18} color={colors.inkMuted} />
              ) : (
                <Eye size={18} color={colors.inkMuted} />
              )}
            </Pressable>
          </View>

          {mode === "up" && (
            <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} layout={settle}>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                onSubmitEditing={submit}
                placeholder="confirm password"
                placeholderTextColor={alpha(colors.inkMuted, 0.7)}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoComplete="new-password"
                style={[styles.input, type.sans, inputColors(colors)]}
              />
            </Animated.View>
          )}

          {/* Sign-up: a quiet strength read. Three pips fill as it hardens. */}
          {mode === "up" && password.length > 0 && (
            <Animated.View entering={FadeIn.duration(160)} style={styles.strengthRow}>
              <View style={styles.pips}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.pip,
                      {
                        backgroundColor:
                          i < strength.score
                            ? strength.score >= 3
                              ? colors.leaf
                              : colors.honey
                            : alpha(colors.ink, 0.12),
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, type.sans, { color: colors.inkMuted }]}>
                {strength.label}
              </Text>
            </Animated.View>
          )}
        </View>

        {error && (
          <Animated.Text
            entering={FadeIn.duration(160)}
            style={[styles.error, type.sans, { color: colors.clay }]}
          >
            {error}
          </Animated.Text>
        )}

        <PressableScale
          scaleTo={0.96}
          onPress={submit}
          disabled={!canSubmit}
          style={[styles.submit, { backgroundColor: colors.ink }, !canSubmit && { opacity: 0.35 }]}
        >
          <Text style={[styles.submitLabel, type.sansSemiBold, { color: colors.paper }]}>
            {busy ? "one sec…" : mode === "in" ? "Sign in" : "Create account"}
          </Text>
        </PressableScale>

        {mode === "up" && (
          <Text style={[styles.fine, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
            8 characters or more. Longer is stronger.
          </Text>
        )}
      </Panel>
    </KeyboardAvoidingView>
  );
}

/** Turn PocketBase's terse auth errors into something human. */
function friendlyError(e: unknown, mode: "in" | "up"): string {
  const msg = e instanceof Error ? e.message : "";
  if (/failed to authenticate|invalid/i.test(msg) && mode === "in")
    return "That email and password don't match.";
  if (/email.*(taken|exists|unique)/i.test(msg) || /validation_not_unique/i.test(msg))
    return "There's already an account with that email.";
  if (/network|fetch/i.test(msg)) return "Can't reach the server — check your connection.";
  return msg || "Something went wrong. Try again.";
}

function inputColors(colors: Palette) {
  return {
    color: colors.ink,
    backgroundColor: colors.paper,
    borderColor: alpha(colors.rule, 0.7),
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  wordmark: {
    fontSize: 40,
    letterSpacing: -0.8,
    textAlign: "center",
  },
  tagline: {
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 24,
  },
  card: {
    padding: 28,
  },
  segment: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 4,
  },
  segmentKey: {
    flex: 1,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    borderRadius: 999,
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 12.5,
  },
  heading: {
    marginTop: 20,
    fontSize: 28,
    letterSpacing: -0.6,
  },
  fields: {
    marginTop: 18,
    gap: 10,
  },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  pwWrap: {
    justifyContent: "center",
  },
  pwInput: {
    paddingRight: 44,
  },
  eye: {
    position: "absolute",
    right: 12,
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  pips: {
    flexDirection: "row",
    gap: 4,
  },
  pip: {
    height: 4,
    width: 26,
    borderRadius: 999,
  },
  strengthLabel: {
    fontSize: 11,
  },
  error: {
    marginTop: 14,
    fontSize: 12.5,
    lineHeight: 17,
  },
  submit: {
    marginTop: 20,
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 13,
  },
  submitLabel: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  fine: {
    marginTop: 12,
    textAlign: "center",
    fontSize: 11,
  },
});
