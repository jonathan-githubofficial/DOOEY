import { Redirect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Eye, EyeOff, PenLine } from "lucide-react-native";
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
import { StampEdge } from "@/components/stamp-edge";
import { signIn, signUp } from "@/features/auth/api";
import { fontStyle } from "@/features/style/tokens";
import { hapticSuccess, hapticTap, hapticWarn } from "@/lib/haptics";
import { alpha, type Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useThemeStore, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(400).damping(32);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINE = 48; // ruled-line spacing; inputs sit one line tall

function strengthOf(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw))) s++;
  return { score: Math.min(3, s), label: ["too short", "okay", "good", "strong"][Math.min(3, s)] };
}

/** The front door as a tactile object: a manila file folder (its tabs switch
 * sign-in / sign-up) holding a ruled index card. You write your details on
 * the lines and press a wax seal to enter. */
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

  const switchTo = (m: "in" | "up") => {
    if (m === mode) return;
    hapticTap();
    setMode(m);
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

  // Manila warms the paper a touch; the folder reads as card stock, not page.
  const manila = dark ? alpha(colors.honey, 0.16) : alpha(colors.honey, 0.28);
  const rule = alpha(colors.sky, dark ? 0.35 : 0.28); // ruled lines, faint blue

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

      <Animated.View entering={FadeInDown.springify().stiffness(220).damping(24)} style={styles.deskArea}>
        {/* The folder tabs — the active one merges into the folder below it. */}
        <View style={styles.tabs}>
          {(["in", "up"] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => switchTo(m)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? manila : alpha(manila, 0.5),
                    borderColor: alpha(colors.honey, 0.4),
                    zIndex: active ? 2 : 1,
                    marginBottom: active ? -1 : 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    type.sansSemiBold,
                    { color: active ? colors.ink : colors.inkMuted },
                  ]}
                >
                  {m === "in" ? "Sign in" : "Sign up"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* The folder itself, holding the index card. */}
        <View
          style={[
            styles.folder,
            {
              backgroundColor: manila,
              borderColor: alpha(colors.honey, 0.4),
              shadowColor: "#282018",
            },
          ]}
        >
          <View
            style={[
              styles.cardStock,
              { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.6) },
            ]}
          >
            <Grain radius={13} />

            {/* A postage stamp, franked into the corner. */}
            <View style={styles.postage}>
              <StampEdge color={alpha(colors.zest, 0.9)} />
              <PenLine size={20} color={colors.paper} />
            </View>

            <Text style={[styles.eyebrow, type.sansMedium, { color: colors.inkMuted }]}>
              {mode === "in" ? "member card" : "new member"}
            </Text>
            <Text style={[styles.heading, type.display, { color: colors.ink }]}>
              {mode === "in" ? "Welcome back." : "Make it yours."}
            </Text>

            {/* The writing area: red margin down the left, faint ruled lines,
                and the fields written straight onto them. */}
            <View style={styles.ruled}>
              <View style={[styles.margin, { backgroundColor: alpha(colors.clay, 0.4) }]} />
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  pointerEvents="none"
                  style={[styles.ruleLine, { top: (i + 1) * LINE - 1, backgroundColor: rule }]}
                />
              ))}

              <LineInput
                value={email}
                onChangeText={setEmail}
                placeholder="email"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                colors={colors}
                type={type}
              />
              <View style={styles.pwRow}>
                <LineInput
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                  placeholder="password"
                  secureTextEntry={!reveal}
                  autoCapitalize="none"
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  textContentType={mode === "in" ? "password" : "newPassword"}
                  colors={colors}
                  type={type}
                  style={styles.flex}
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
                  <LineInput
                    value={confirm}
                    onChangeText={setConfirm}
                    onSubmitEditing={submit}
                    placeholder="confirm password"
                    secureTextEntry={!reveal}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    colors={colors}
                    type={type}
                  />
                </Animated.View>
              )}
            </View>

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

            {error && (
              <Animated.Text
                entering={FadeIn.duration(160)}
                style={[styles.error, type.sans, { color: colors.clay }]}
              >
                {error}
              </Animated.Text>
            )}

            {/* The submit: a wax seal you press to enter. */}
            <View style={styles.sealRow}>
              <WaxSeal
                label={mode === "in" ? "press to sign in" : "press to seal it"}
                disabled={!canSubmit}
                busy={busy}
                onPress={submit}
              />
            </View>
          </View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/** An input written on a ruled line: no box, just ink on the line. */
function LineInput({
  colors,
  type,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  colors: Palette;
  type: ReturnType<typeof useType>;
}) {
  return (
    <TextInput
      placeholderTextColor={alpha(colors.inkMuted, 0.55)}
      style={[styles.lineInput, type.sans, { color: colors.ink }, style]}
      {...props}
    />
  );
}

/** A blob of sealing wax with the DOOEY monogram embossed — presses in on
 * tap. The gloss is a diagonal sheen; the emboss is a light top edge over a
 * darker face. */
function WaxSeal({
  label,
  disabled,
  busy,
  onPress,
}: {
  label: string;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <PressableScale
      scaleTo={0.9}
      rotate={-6}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={styles.sealPress}
    >
      <View style={[styles.seal, disabled && { opacity: 0.4 }]}>
        <LinearGradient
          colors={[alpha("#ffffff", 0.5), alpha(colors.clay, 0), alpha("#000000", 0.28)]}
          start={{ x: 0.15, y: 0.1 }}
          end={{ x: 0.9, y: 0.95 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.sealRim, { borderColor: alpha("#000000", 0.18) }]} />
        <Text style={[styles.sealMark, fontStyle("fraunces", "900"), { color: alpha("#000000", 0.28) }]}>
          {busy ? "…" : "D"}
        </Text>
      </View>
      <Text style={[styles.sealLabel, type.sansMedium, { color: colors.inkMuted }]}>{label}</Text>
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
    marginBottom: 22,
  },
  deskArea: {
    alignSelf: "stretch",
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    paddingLeft: 18,
  },
  tab: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 9,
  },
  tabText: {
    fontSize: 12.5,
  },
  folder: {
    borderWidth: 1,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 10,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardStock: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 22,
    overflow: "hidden",
  },
  postage: {
    position: "absolute",
    top: 16,
    right: 16,
    height: 40,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "6deg" }],
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heading: {
    marginTop: 6,
    fontSize: 27,
    letterSpacing: -0.6,
  },
  ruled: {
    marginTop: 16,
    position: "relative",
  },
  margin: {
    position: "absolute",
    left: 22,
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  ruleLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  lineInput: {
    height: LINE,
    paddingLeft: 34,
    paddingRight: 4,
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
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 34,
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
    paddingLeft: 34,
  },
  sealRow: {
    marginTop: 22,
    alignItems: "center",
  },
  sealPress: {
    alignItems: "center",
    gap: 10,
  },
  seal: {
    height: 68,
    width: 68,
    borderRadius: 999,
    backgroundColor: "#a8412c",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#282018",
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sealRim: {
    ...StyleSheet.absoluteFillObject,
    margin: 5,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  sealMark: {
    fontSize: 30,
    lineHeight: 34,
  },
  sealLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
