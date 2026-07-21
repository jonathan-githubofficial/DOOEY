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
const LINE = 40; // ruled-line rhythm; each field is one line tall
const RINGS = 6;

function strengthOf(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[^A-Za-z0-9]/.test(pw) || (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw))) s++;
  return { score: Math.min(3, s), label: ["too short", "okay", "good", "strong"][Math.min(3, s)] };
}

/** The front door as the first page of your DOOEY: a ruled, ring-bound sheet
 * (the planner's own binder), your details written on the lines, a rubber
 * stamp to enter. */
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

  const rows = mode === "up" ? 3 : 2;
  const rule = alpha(colors.sky, dark ? 0.32 : 0.22);

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

      <Animated.View entering={FadeInDown.springify().stiffness(200).damping(22)} style={styles.deskArea}>
        {/* The binder wire, arcing over the top edge — the planner's own. */}
        <Rings />

        {/* The page. */}
        <View
          style={[
            styles.page,
            {
              backgroundColor: colors.surface,
              borderColor: alpha(colors.rule, 0.6),
              shadowColor: "#282018",
            },
          ]}
        >
          <Grain radius={19} />
          {/* Top-lit paper edge. */}
          <View
            pointerEvents="none"
            style={[styles.topEdge, { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)" }]}
          />
          {/* Punched holes, dead-centre under each ring. */}
          <View pointerEvents="none" style={styles.holes}>
            {Array.from({ length: RINGS }).map((_, i) => (
              <View key={i} style={styles.holeSlot}>
                <LinearGradient
                  colors={[alpha(colors.ink, 0.22), alpha(colors.ink, 0.08)]}
                  style={styles.hole}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.brand, fontStyle("fraunces", "900"), { color: colors.ink }]}>
            DOOEY<Text style={{ color: colors.zest }}>.</Text>
          </Text>
          <Text style={[styles.eyebrow, type.sansMedium, { color: colors.inkMuted }]}>
            {mode === "in" ? "sign in" : "new member"}
          </Text>
          <Text style={[styles.heading, type.display, { color: colors.ink }]}>
            {mode === "in" ? "Welcome back." : "Make it yours."}
          </Text>

          {/* The writing area: a red margin, faint blue rules, ink on the line. */}
          <View style={[styles.ruled, { height: rows * LINE }]}>
            <View style={[styles.margin, { backgroundColor: alpha(colors.clay, 0.35) }]} />
            {Array.from({ length: rows }).map((_, i) => (
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
                {reveal ? <EyeOff size={17} color={colors.inkMuted} /> : <Eye size={17} color={colors.inkMuted} />}
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
            <Animated.View entering={FadeIn.duration(160)} layout={settle} style={styles.strengthRow}>
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
              layout={settle}
              style={[styles.error, type.sans, { color: colors.clay }]}
            >
              {error}
            </Animated.Text>
          )}

          <Animated.View layout={settle} style={styles.footer}>
            <StampSubmit
              label={busy ? "one sec" : mode === "in" ? "sign in" : "sign up"}
              disabled={!canSubmit}
              onPress={submit}
            />
            <Pressable onPress={swap} hitSlop={8}>
              <Text style={[styles.swap, type.sansMedium, { color: colors.inkMuted }]}>
                {mode === "in" ? "new here? " : "have an account? "}
                <Text style={{ color: colors.zest }}>{mode === "in" ? "make one" : "sign in"}</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Two more pages of the pad, peeking out below — depth, like the planner. */}
        <View
          pointerEvents="none"
          style={[
            styles.padEdge,
            { marginHorizontal: 10, backgroundColor: alpha(colors.surface, 0.9), borderColor: alpha(colors.rule, 0.5) },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.padEdge,
            { marginHorizontal: 22, backgroundColor: alpha(colors.surface, 0.7), borderColor: alpha(colors.rule, 0.4) },
          ]}
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

/** The three slim binder loops, arcing over the page's top edge. */
function Rings() {
  const colors = usePalette();
  const dark = useThemeStore((s) => s.theme) === "dark";
  return (
    <View pointerEvents="none" style={styles.ringRow}>
      {Array.from({ length: RINGS }).map((_, i) => (
        <View key={i} style={styles.ringSlot}>
          <View style={styles.ringShadow}>
            <LinearGradient
              colors={
                dark
                  ? ["rgba(255,255,255,0.4)", "rgba(255,255,255,0.1)", "rgba(0,0,0,0.4)"]
                  : ["#ffffff", alpha(colors.ink, 0.05), alpha(colors.ink, 0.3)]
              }
              style={[styles.ring, { borderColor: dark ? "rgba(255,255,255,0.3)" : alpha(colors.ink, 0.4) }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** An input written on a ruled line — no box, ink sitting on the rule. */
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
      placeholderTextColor={alpha(colors.inkMuted, 0.5)}
      style={[styles.lineInput, type.sans, { color: colors.ink }, style]}
      {...props}
    />
  );
}

/** The submit as a red rubber stamp — a double-ruled border, tracked caps,
 * grain showing through, tilted; it presses and straightens on tap. */
function StampSubmit({
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
      scaleTo={0.93}
      rotate={-3}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stamp, { borderColor: colors.clay }, disabled && { opacity: 0.35 }]}
    >
      <Grain radius={6} />
      <View style={[styles.stampInner, { borderColor: alpha(colors.clay, 0.45) }]} />
      <Text style={[styles.stampText, type.sansSemiBold, { color: colors.clay }]}>{label}</Text>
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
    paddingHorizontal: 22,
  },
  deskArea: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  ringRow: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: -14,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ringSlot: {
    width: 12,
    alignItems: "center",
  },
  ringShadow: {
    borderRadius: 999,
    shadowColor: "#282018",
    shadowOpacity: 0.28,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  ring: {
    height: 30,
    width: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  page: {
    borderWidth: 1,
    borderRadius: 20,
    paddingTop: 30,
    paddingHorizontal: 26,
    paddingBottom: 26,
    overflow: "hidden",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  topEdge: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    height: 1,
  },
  holes: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: 11,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  holeSlot: {
    width: 12,
    alignItems: "center",
  },
  hole: {
    height: 9,
    width: 9,
    borderRadius: 999,
  },
  brand: {
    fontSize: 22,
    letterSpacing: -0.5,
  },
  eyebrow: {
    marginTop: 14,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heading: {
    marginTop: 4,
    fontSize: 27,
    letterSpacing: -0.6,
  },
  ruled: {
    marginTop: 18,
    position: "relative",
  },
  margin: {
    position: "absolute",
    left: 20,
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
    paddingLeft: 32,
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
    height: LINE,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  strengthRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 32,
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
    paddingLeft: 32,
  },
  padEdge: {
    height: 14,
    marginTop: -9,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    zIndex: -1,
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stamp: {
    borderWidth: 2,
    borderRadius: 9,
    paddingHorizontal: 20,
    paddingVertical: 11,
    overflow: "hidden",
  },
  stampInner: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  stampText: {
    fontSize: 13,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  swap: {
    fontSize: 12,
    maxWidth: 130,
    textAlign: "right",
  },
});
