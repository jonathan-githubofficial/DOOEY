import { getRouteApi, useRouter } from "@tanstack/react-router";
import { SignInCard } from "@/features/auth";

// The front door (unit 3.1 built the shell; unit 3.2 completes it): wordmark + centred layout
// (3.1) plus the <SignInCard> mount and the redirect round-trip (3.2's half of the 3.1/3.2
// split - see the story BROOM, which also removed src-legacy/pages/Login.tsx).
const route = getRouteApi("/login");

export function Login() {
  const router = useRouter();
  // `redirect` is a full href (path + search) the guard (3.1) stashed on the search params.
  const { redirect } = route.useSearch();

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
      {/* The round-trip: `redirect` is a full href, so it goes through `router.history` rather
          than a typed `navigate({ to })` (matches the src-legacy comment). On memory history
          this returns the user to the space the guard bounced them from. */}
      <SignInCard onSignedIn={() => router.history.push(redirect ?? "/")} />
    </view>
  );
}
