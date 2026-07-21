// Email + password sign in / sign up (unit 3.2, ported from
// src-legacy/features/auth/components/SignInCard.tsx onto Lynx elements). Owns the whole flow;
// calls `onSignedIn` once the session is live and the learning store has synced.
//
// Element mapping (crib "Elements, not HTML"): the old <div> wrappers become <view>, the
// <h2>/<p>/<button> become <text>/<view bindtap> (Lynx has no <button>), and every <text>
// carries its colour/font/size explicitly because <text> does not inherit CSS. Dropped from the
// DOM original (recorded in the story BROOM): the `autoComplete` attributes (DOM-only, no
// behaviour depends on them) and the password field's Enter-to-submit `onKeyDown` (the L2 2.3
// Input exposes no confirm/enter event - the button is the primary submit path). Password
// masking rides the L2 Input's `type="password"` (real masked <input> on the web target).
import { useState } from "react";
import { Eyebrow, Panel } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLearningStore } from "@/features/learning/store";
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
    <Panel className="p-8 md:p-10" data-testid="signin-card">
      <view className="flex items-baseline justify-between">
        <Eyebrow>{mode === "in" ? "sign in" : "create account"}</Eyebrow>
        {/* Old <button> -> <view bindtap> (no <button> on Lynx); `hover:` dropped (no hover
            selector on the web target, per 2.3). */}
        <view
          bindtap={() => setMode((m) => (m === "in" ? "up" : "in"))}
          data-testid="signin-toggle"
        >
          <text className="text-[10px] uppercase tracking-[0.22em] text-zest font-sans">
            {mode === "in" ? "new here?" : "have an account?"}
          </text>
        </view>
      </view>
      <text
        className="mt-2 font-display text-3xl font-bold tracking-tight text-ink"
        data-testid="signin-heading"
      >
        {mode === "in" ? "Welcome back." : "Make it yours."}
      </text>
      <view className="mt-5 space-y-2">
        <Input type="email" value={email} onInput={setEmail} placeholder="email" />
        <Input type="password" value={password} onInput={setPassword} placeholder="password" />
      </view>
      {error && (
        <text className="mt-3 text-xs text-clay font-sans" data-testid="signin-error">
          {error}
        </text>
      )}
      <view className="mt-5">
        {/* self-start: the button is inline-flex (content width) in the DOM original, but a Lynx
            <view>'s default cross-axis stretch would blow it out to full width. */}
        <Button
          size="sm"
          className="self-start"
          onClick={submit}
          disabled={busy || !email.trim() || !password}
          data-testid="signin-submit"
        >
          {busy ? "…" : mode === "in" ? "sign in" : "sign up"}
        </Button>
      </view>
    </Panel>
  );
}
