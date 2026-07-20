import { getRouteApi, useRouter } from "@tanstack/react-router";
import { SignInCard } from "@/features/auth";

const route = getRouteApi("/login");

/** The front door: just the wordmark and the sign-in card, centred on paper.
 * On success it returns you to wherever the guard bounced you from. */
export function Login() {
  const router = useRouter();
  const { redirect } = route.useSearch();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
      <p className="mb-6 text-center font-display text-3xl font-black tracking-tight text-ink">
        DOOEY<span className="text-zest">.</span>
      </p>
      {/* `redirect` is a full href (path + search), so it goes through history
          rather than a typed `to`. */}
      <SignInCard onSignedIn={() => router.history.push(redirect ?? "/")} />
    </main>
  );
}
