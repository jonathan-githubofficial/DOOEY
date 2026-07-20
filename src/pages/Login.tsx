import { getRouteApi } from "@tanstack/react-router";

// The front door SHELL only (unit 3.1's half of the 3.1/3.2 split): wordmark + centred
// layout + the `redirect` search wiring. The <SignInCard onSignedIn=...> and the
// `router.history.push(redirect ?? "/")` round-trip land in 3.2 (see the story BROOM),
// which also removes src-legacy/pages/Login.tsx.
const route = getRouteApi("/login");

export function Login() {
  // `redirect` is a full href (path + search) the guard stashed; 3.2's SignInCard pushes
  // back to it after sign-in. 3.1 only proves the search param is wired and typed.
  const { redirect } = route.useSearch();
  void redirect;

  return (
    // <main> -> <view>; env(safe-area-inset-*) resolves on the web target (unit 2.3 note).
    <view
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12"
      data-testid="login-screen"
    >
      {/* Crib "Elements": <text> does not inherit CSS - font + colour set on each node.
          The zest "." is its own nested <text> carrying the same display font + size. */}
      <text
        className="mb-6 text-center font-display text-3xl font-black tracking-tight text-ink"
        data-testid="login-wordmark"
      >
        DOOEY
        <text className="font-display text-3xl font-black text-zest">.</text>
      </text>
    </view>
  );
}
