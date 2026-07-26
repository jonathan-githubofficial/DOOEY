import type { DockChoice } from "@/features/home/layout";

/** The spaces behind the tab bar.
 *
 * Declared once because there are two tab bars: the platform's own on native
 * (which wants SF Symbol and Material glyph names) and DOOEY's dock island on
 * the web (which wants lucide components). They had a list each, and the lists
 * had already drifted — one had five entries, the other four.
 *
 * Only the facts every renderer needs live here. Icons do not: a name is data,
 * a lucide component is UI, and this file has no business importing either
 * icon set. Each bar maps `route` to its own glyph.
 *
 * Order and visibility of the middle spaces belong to the user (the "Your
 * dock" panel in Account); both bars render `useDock()` from
 * features/home/store, never this array directly.
 *
 * `doodle` is the key into the user's hand-drawn page icons, which replace the
 * stock glyphs when "doodle icons in dock" is on. */
export const SPACES = [
  { route: "index", label: "Home", doodle: "home", sf: "house", md: "home" },
  { route: "planner", label: "Planner", doodle: "planner", sf: "checklist", md: "event-note" },
  { route: "boards", label: "Boards", doodle: "boards", sf: "square.on.square", md: "dashboard" },
  { route: "projects", label: "Projects", doodle: "learning", sf: "folder", md: "folder" },
  { route: "gym", label: "Gym", doodle: "gym", sf: "dumbbell", md: "fitness-center" },
  { route: "account", label: "Account", doodle: "account", sf: "person.crop.circle", md: "person" },
] as const;

export type SpaceRoute = (typeof SPACES)[number]["route"];
export type Space = (typeof SPACES)[number];

export function spaceOf(route: SpaceRoute): Space {
  return SPACES.find((s) => s.route === route)!;
}

/** The dock, resolved: Home pinned first, Account pinned last, the user's
 * visible middle spaces in their order between them. */
export function resolveDock(
  order: readonly DockChoice[],
  hidden: readonly DockChoice[],
): SpaceRoute[] {
  return ["index", ...order.filter((r) => !hidden.includes(r)), "account"];
}

/** Which space a drill-in belongs to, so its parent stop stays lit: a task
 * page is the planner's, a board is Boards', a workout is the gym's. */
const DRILL: ReadonlyArray<readonly [string, SpaceRoute]> = [
  ["task", "planner"],
  ["compose", "planner"],
  ["board", "boards"],
  ["project/", "projects"],
  ["workout", "gym"],
  ["routine", "gym"],
];

export function spaceFor(routeName: string): SpaceRoute {
  if (SPACES.some((s) => s.route === routeName)) return routeName as SpaceRoute;
  for (const [prefix, route] of DRILL) if (routeName.startsWith(prefix)) return route;
  return "account";
}
