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
import { ThemeVars } from "@/features/style";
import { Dock } from "@/components/dock";
import { Login } from "@/pages/Login";
import { Gallery } from "@/pages/Gallery";
import { Account } from "@/pages/Account";
import { Style } from "@/pages/Style";
import { TaskPage } from "@/pages/Task";
import { StatusSurface } from "@/components/status-surface";
import {
  InterimBoards,
  InterimCalendar,
  InterimIndex,
  InterimProjects,
} from "@/pages/_interim";

// SPEC 1 (crib "Routing"; doc https://lynxjs.org/react/routing/tanstack-router): Lynx has
// no History API, so the router runs on an explicit MEMORY history. `createMemoryHistory` is
// exported from @tanstack/react-router at the pinned version (verified) and is the import the
// doc prescribes. (startTransition is supplied by the `react$ -> @lynx-js/react/compat` alias
// in lynx.config.ts per SPEC 2; URLSearchParams is polyfilled at the entry per SPEC 3.)
const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

// SPEC 4 - root route: the backdrop + the outlet, now wrapped by <ThemeVars> (unit 3.4). ThemeVars
// is the app-root <view> that carries the resolved CSS-variable palette inline + the `dark` class,
// so BOTH the <Backdrop/> and every routed screen are inside it and inherit the theme (ruling R11:
// theme applies via the root-view CSS-variable cascade, never document).
const rootRoute = createRootRoute({
  component: () => (
    <ThemeVars>
      <Backdrop />
      <Outlet />
    </ThemeVars>
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
  // Unit 3.3 adds the persistent <Dock/> to the authed shell (3.1 left it out on purpose). The
  // shell's bottom padding already reserves room for the fixed dock; the dock renders only inside
  // the guard, so it never shows on /login.
  component: () => (
    <view className="mx-auto min-h-dvh max-w-3xl px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] md:px-6 md:pt-[calc(3rem+env(safe-area-inset-top))]">
      <Outlet />
      <Dock />
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

// Unit 3.3 routes. `accountRoute` is the real Account page; /style is now the real Style studio
// (unit 3.4, below). /calendar, /boards, /projects remain INTERIM screens registered so the dock's
// four typed navigations + Account's "Style studio" link compile and land. Their owning layers
// replace each interim: /calendar -> 5.1, /boards -> 7.1, /projects -> 6.1. IDs follow the
// /app/<path> convention (auto from the parent + path).
const accountRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/account",
  component: Account,
});
const calendarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/calendar",
  component: InterimCalendar,
});
const boardsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/boards",
  component: InterimBoards,
});
const projectsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/projects",
  component: InterimProjects,
});
// Unit 3.4 replaces 3.3's interim /style with the real Style studio page.
const styleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/style",
  component: Style,
});
// Unit 4.2: the task page. Route id "/app/task/$id" (guard parent + path), path "/task/$id"
// (CLAUDE.md Auth); TaskPage reads the id via useParams({ from: "/app/task/$id" }).
const taskRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/task/$id",
  component: TaskPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    loginRoute,
    galleryRoute,
    appRoute.addChildren([
      todayRoute,
      accountRoute,
      calendarRoute,
      boardsRoute,
      projectsRoute,
      styleRoute,
      taskRoute,
    ]),
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
