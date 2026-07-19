import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { pb } from "@/lib/pb";
import { Dock } from "@/components/dock";
import { Backdrop } from "@/features/style";
import { Login } from "@/pages/Login";
import { Today } from "@/pages/Today";
import { Projects } from "@/pages/Projects";
import { TaskPage } from "@/pages/Task";
import { Account } from "@/pages/Account";
import { Calendar } from "@/pages/Calendar";
import { Boards } from "@/pages/Boards";
import { Board } from "@/pages/Board";
import { Style } from "@/pages/Style";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Backdrop />
      <Outlet />
    </>
  ),
});

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

// Every space lives behind this guard: no session → the front door, with the
// intended destination remembered so signing in drops you where you meant to go.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: ({ location }) => {
    if (!pb.authStore.isValid) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => (
    <>
      {/* safe-area insets keep content clear of the notch + home indicator in
          the native shells; they resolve to 0 in a desktop browser. */}
      <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] md:px-6 md:pt-[calc(3rem+env(safe-area-inset-top))]">
        <Outlet />
      </main>
      <Dock />
    </>
  ),
});

const todayRoute = createRoute({ getParentRoute: () => appRoute, path: "/", component: Today });
const projectsRoute = createRoute({ getParentRoute: () => appRoute, path: "/projects", component: Projects });
const taskRoute = createRoute({ getParentRoute: () => appRoute, path: "/task/$id", component: TaskPage });
const accountRoute = createRoute({ getParentRoute: () => appRoute, path: "/account", component: Account });
const styleRoute = createRoute({ getParentRoute: () => appRoute, path: "/style", component: Style });
const calendarRoute = createRoute({ getParentRoute: () => appRoute, path: "/calendar", component: Calendar });
const boardsRoute = createRoute({ getParentRoute: () => appRoute, path: "/boards", component: Boards });
const boardRoute = createRoute({ getParentRoute: () => appRoute, path: "/board/$id", component: Board });

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    loginRoute,
    appRoute.addChildren([
      todayRoute,
      projectsRoute,
      taskRoute,
      accountRoute,
      styleRoute,
      calendarRoute,
      boardsRoute,
      boardRoute,
    ]),
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

// Any sign-in/sign-out — including a session dropped by initSession — re-runs
// the guards, so a stale screen can never outlive its session.
pb.authStore.onChange(() => {
  void router.invalidate();
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
