import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { pb } from "@/lib/pb";
import { Backdrop } from "@/features/style/components/Backdrop";
import { Login } from "@/pages/Login";
import { Gallery } from "@/pages/Gallery";
import { StatusSurface } from "@/components/status-surface";
import { InterimIndex } from "@/pages/_interim";

// SPEC 1 (crib "Routing"; doc https://lynxjs.org/react/routing/tanstack-router): Lynx has
// no History API, so the router runs on an explicit MEMORY history. `createMemoryHistory` is
// exported from @tanstack/react-router at the pinned version (verified) and is the import the
// doc prescribes. (startTransition is supplied by the `react$ -> @lynx-js/react/compat` alias
// in lynx.config.ts per SPEC 2; URLSearchParams is polyfilled at the entry per SPEC 3.)
const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

// SPEC 4 - root route ported verbatim in shape: just the backdrop + the outlet.
const rootRoute = createRootRoute({
  component: () => (
    <>
      <Backdrop />
      <Outlet />
    </>
  ),
});

// PUBLIC. SPEC 7: `redirect` is string | undefined; a live session skips the front door.
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: () => {
    if (pb.authStore.isValid) {
      throw redirect({ to: "/" });
    }
  },
  component: Login,
});

// PUBLIC. The L2 Gallery (the @l2 E2E surface) plus unit 1.4's StatusSurface (the @l1 auth/
// live-count oracle) - together the temporary app-root body before 3.1. They move here so
// both stay mounted (SPEC 9); memory history has no address bar, so the E2E router bridge
// (below) navigates specs to /gallery.
const galleryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/gallery",
  component: () => (
    <>
      <Gallery />
      <StatusSurface />
    </>
  ),
});

// GUARD (pathless layout). SPEC 7, ported verbatim from src-legacy/router.tsx (HIGH-RISK):
// no session -> the front door, with the intended destination remembered. `location` is the
// TanStack route location (memory history: location.href is pathname + search), NOT
// window.location (absent on Lynx). The component is the authed shell - a safe-area-padded
// <view> wrapping the outlet; the Dock is added by 3.3, not here.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: ({ location }) => {
    if (!pb.authStore.isValid) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => (
    <view className="mx-auto min-h-dvh max-w-3xl px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] md:px-6 md:pt-[calc(3rem+env(safe-area-inset-top))]">
      <Outlet />
    </view>
  ),
});

// SPEC 6 (incremental-tree rule): only the guarded index exists by end of 3.1. `todayRoute`
// (path "/", id "/app/") carries an INTERIM landing component until unit 4.1 lands Today.
// The remaining app routes (projects/task/account/style/calendar/boards/board) are registered
// by their owning later units (3.3/3.4/4.2/5.1/6.1/7.1/7.2), each replacing an interim.
const todayRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: InterimIndex,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    loginRoute,
    galleryRoute,
    appRoute.addChildren([todayRoute]),
  ]),
  history: memoryHistory,
  defaultPreload: "intent",
  scrollRestoration: true,
});

// SPEC 9 - E2E router bridge. Memory history has no URL bar, so specs cannot navigate by
// address. Exposed on the (web-worker) global ONLY in the E2E build - PUBLIC_DOOEY_E2E is set
// by playwright.config.ts's webServer; it is unset in dev and in 8.1's prod bundle, so the
// bridge never ships. (`rspeedy build` runs in production mode, so a `MODE !== "production"`
// gate would be false in the E2E build too - a dedicated PUBLIC_ flag is required.) Specs
// reach it through the web-core background worker (page.workers()) to navigate + read
// router.state.location.pathname.
if (import.meta.env.PUBLIC_DOOEY_E2E) {
  (globalThis as unknown as { __dooeyRouter?: typeof router }).__dooeyRouter = router;
}

// SPEC 8 - any sign-in/sign-out (including a session dropped by initSession) re-runs the
// guards, so a stale screen can never outlive its session. 3.1 only WIRES this; the
// behavioural session-drop E2E is 3.2.
pb.authStore.onChange(() => {
  void router.invalidate();
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
