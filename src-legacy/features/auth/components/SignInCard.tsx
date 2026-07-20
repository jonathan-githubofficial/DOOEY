import { useState } from "react";
import { Eyebrow, Panel } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLearningStore } from "@/features/learning";
import { signIn, signUp } from "../api";

/** Email + password sign in / sign up. Owns the whole flow; calls `onSignedIn`
 * once the session is live and the learning store has synced. */
export function SignInCard({ onSignedIn }: { onSignedIn: () => void }) {
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
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign in");
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
      <div className="mt-5 space-y-2">
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
