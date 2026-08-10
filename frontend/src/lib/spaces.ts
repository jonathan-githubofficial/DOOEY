
/** The spaces behind the tab bar.
 *
 * Declared once because there are two tab bars: iOS's own (which wants SF
 * Symbol names) and DOOEY's dock island, which draws for Android and the web
 * (and wants lucide components). They had a list each, and the lists had
 * already drifted — one had five entries, the other four.
 *
 * Only the facts every renderer needs live here. Icons do not: a name is data,
 * a lucide component is UI, and this file has no business importing either
 * icon set. Each bar maps `route` to its own glyph.
 *
 * **This array is the bar.** Order and visibility used to be the user's, saved
 * on `users.shell` and edited from a panel in Account, and that one feature
 * cost a store, a persistence path, a page of list arithmetic, and a race in
 * the native tab bar that took two attempts to close. Five spaces fit; nobody
 * needed to hide one. Add a space here and both bars grow it.
 *
 * `doodle` is the key into the user's hand-drawn page icons, which replace the
 * stock glyphs when "doodle icons in dock" is on. */
export const SPACES = [
  { route: "index", label: "Today", doodle: "today", sf: "checklist" },
  { route: "stamps", label: "Stamps", doodle: "stamps", sf: "checkmark.seal" },
  { route: "gym", label: "Gym", doodle: "gym", sf: "dumbbell" },
  { route: "boards", label: "Boards", doodle: "boards", sf: "square.on.square" },
  { route: "account", label: "You", doodle: "account", sf: "person.crop.circle" },
] as const;

export type SpaceRoute = (typeof SPACES)[number]["route"];
export type Space = (typeof SPACES)[number];

/** A route name to its space. Every caller only ever passes either one of the
 * five tab routes themselves, or something else entirely (a shell page like
 * `style`, reached from Account) — detail pages (task, board, workout…) push
 * onto the root stack above the tab navigators, so they never reach this
 * function at all. Direct match, Account as the fallback, nothing more. */
export function spaceFor(routeName: string): SpaceRoute {
  if (SPACES.some((s) => s.route === routeName)) return routeName as SpaceRoute;
  return "account";
}
