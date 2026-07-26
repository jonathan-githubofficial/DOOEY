/** The spaces behind the tab bar, in order.
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
 * `doodle` is the key into the user's hand-drawn page icons, which replace the
 * stock glyphs when "doodle icons in dock" is on. */
export const SPACES = [
  { route: "index", label: "Planner", doodle: "planner", sf: "checklist", md: "event-note" },
  { route: "boards", label: "Boards", doodle: "boards", sf: "square.on.square", md: "dashboard" },
  { route: "projects", label: "Projects", doodle: "learning", sf: "folder", md: "folder" },
  { route: "gym", label: "Gym", doodle: "gym", sf: "dumbbell", md: "fitness-center" },
  { route: "account", label: "Account", doodle: "account", sf: "person.crop.circle", md: "person" },
] as const;

export type SpaceRoute = (typeof SPACES)[number]["route"];

/** Which space a route belongs to, so a drill-in keeps its parent stop lit: a
 * task page is the planner's, a board is Boards', a workout is the gym's. */
export function spaceFor(routeName: string): SpaceRoute {
  if (routeName === "index" || routeName.startsWith("task")) return "index";
  if (routeName === "boards" || routeName.startsWith("board")) return "boards";
  if (routeName === "projects" || routeName.startsWith("project/")) return "projects";
  if (routeName === "gym" || routeName.startsWith("workout") || routeName.startsWith("routine"))
    return "gym";
  return "account";
}
