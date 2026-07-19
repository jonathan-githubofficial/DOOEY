import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { Dock } from "@/components/dock";
import { Backdrop } from "@/features/style";
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
      <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-32 pt-8 md:px-6 md:pt-12">
        <Outlet />
      </main>
      <Dock />
    </>
  ),
});

const todayRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Today });
const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/projects", component: Projects });
const taskRoute = createRoute({ getParentRoute: () => rootRoute, path: "/task/$id", component: TaskPage });
const accountRoute = createRoute({ getParentRoute: () => rootRoute, path: "/account", component: Account });
const styleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/style", component: Style });
const calendarRoute = createRoute({ getParentRoute: () => rootRoute, path: "/calendar", component: Calendar });
const boardsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/boards", component: Boards });
const boardRoute = createRoute({ getParentRoute: () => rootRoute, path: "/board/$id", component: Board });

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    todayRoute,
    projectsRoute,
    taskRoute,
    accountRoute,
    styleRoute,
    calendarRoute,
    boardsRoute,
    boardRoute,
  ]),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
