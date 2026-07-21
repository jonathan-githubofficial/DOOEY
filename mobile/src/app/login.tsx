import { Redirect, useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { signIn, signUp } from "@/features/auth/api";
import { alpha, type Palette } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette, useType } from "@/stores/theme";

/** The front door: just the wordmark and the sign-in card, centred on paper. */
export default function Login() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) return <Redirect href="/" />;

  const submit = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
      setBusy(false);
    }
  };

  const canSubmit = !busy && !!email.trim() && !!password;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.screen,
        { backgroundColor: colors.paper, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Grain />
      <Text style={[styles.wordmark, type.displayBlack, { color: colors.ink }]}>
        DOOEY
        <Text style={{ color: colors.zest }}>.</Text>
      </Text>

      <Panel style={styles.card}>
        <View style={styles.cardHead}>
          <Eyebrow>{mode === "in" ? "sign in" : "create account"}</Eyebrow>
          <Pressable onPress={() => setMode((m) => (m === "in" ? "up" : "in"))}>
            <Text style={[styles.modeSwitch, type.sansMedium, { color: colors.zest }]}>
              {mode === "in" ? "new here?" : "have an account?"}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.heading, type.display, { color: colors.ink }]}>
          {mode === "in" ? "Welcome back." : "Make it yours."}
        </Text>

        <View style={styles.fields}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[styles.input, type.sans, inputColors(colors)]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            placeholder="password"
            placeholderTextColor={colors.inkMuted}
            secureTextEntry
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            style={[styles.input, type.sans, inputColors(colors)]}
          />
        </View>

        {error && <Text style={[styles.error, type.sans, { color: colors.clay }]}>{error}</Text>}

        <PressableScale
          scaleTo={0.96}
          onPress={submit}
          disabled={!canSubmit}
          style={[
            styles.submit,
            { backgroundColor: colors.ink },
            !canSubmit && { opacity: 0.4 },
          ]}
        >
          <Text style={[styles.submitLabel, type.sansSemiBold, { color: colors.paper }]}>
            {busy ? "…" : mode === "in" ? "sign in" : "sign up"}
          </Text>
        </PressableScale>
      </Panel>
    </KeyboardAvoidingView>
  );
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
    fontSize: 30,
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    padding: 32,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  modeSwitch: {
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  heading: {
    marginTop: 8,
    fontSize: 30,
    letterSpacing: -0.6,
  },
  fields: {
    marginTop: 20,
    gap: 8,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  error: {
    marginTop: 12,
    fontSize: 12,
  },
  submit: {
    marginTop: 20,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  submitLabel: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
