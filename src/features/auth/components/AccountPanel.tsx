import { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel, StampButton } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore, useThemeStore } from "@/stores";
import { useLearningStore } from "@/features/learning";
import { signIn, signOut, signUp } from "../api";
import { AvatarDoodle } from "./AvatarDoodle";

/** The account space: sign in / sign up when signed out; your doodled self,
 * email and sign-out when signed in. */
export function AccountPanel() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  return isAuthed ? <SignedIn /> : <SignInForm />;
}

function SignedIn() {
  const user = useAuthStore((s) => s.user);
  return (
    <Panel className="p-8 md:p-10">
      <Eyebrow>account</Eyebrow>
      <div className="mt-4 flex items-center gap-5">
        <AvatarDoodle />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-bold tracking-tight text-ink">
            {user?.email}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Tap the doodle to redraw yourself.
          </p>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-rule/50 pt-5">
        <span className="text-sm font-medium text-ink">Appearance</span>
        <ThemeToggle />
      </div>

      <div className="mt-5">
        <StampButton onClick={signOut} className="text-ink-muted">
          <LogOut className="h-4 w-4" /> Sign out
        </StampButton>
      </div>
    </Panel>
  );
}

/** A spring-loaded light/dark switch: the knob slides, sun ⇄ moon. */
function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle light / dark mode"
      onClick={toggle}
      className={cn(
        "inset-well relative flex h-9 w-[4.25rem] items-center rounded-full px-1 transition-colors",
        dark ? "bg-ink/30" : "bg-honey/25",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn(
          "grain flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-soft",
          dark && "ml-auto",
        )}
      >
        {dark ? <Moon className="h-4 w-4 text-sky" /> : <Sun className="h-4 w-4 text-honey" />}
      </motion.span>
    </button>
  );
}

function SignInForm() {
  const syncWithPB = useLearningStore((s) => s.syncWithPB);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      await syncWithPB();
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-8 md:p-10">
      <div className="flex items-baseline justify-between">
        <Eyebrow>{mode === "in" ? "sign in" : "create account"}</Eyebrow>
        <button
          onClick={() => setMode((m) => (m === "in" ? "up" : "in"))}
          className="text-[10px] uppercase tracking-[0.22em] text-zest transition-colors hover:text-ink"
        >
          {mode === "in" ? "new here?" : "have an account?"}
        </button>
      </div>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
        {mode === "in" ? "Welcome back." : "Make it yours."}
      </h2>
      <div className="mt-5 max-w-sm space-y-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="email"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
        />
      </div>
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
      <div className="mt-5">
        <Button size="sm" onClick={submit} disabled={busy || !email.trim() || !password}>
          {busy ? "…" : mode === "in" ? "sign in" : "sign up"}
        </Button>
      </div>
    </Panel>
  );
}
