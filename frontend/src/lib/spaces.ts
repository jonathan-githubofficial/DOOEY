
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
 * dock" panel in Account) and come from `useDock()` in features/home/store —
 * but this array stays the registry both bars draw facts from: the native
 * bar also reads it directly for the hidden complement (every space needs a
 * Trigger, dock or not).
 *
 * `doodle` is the key into the user's hand-drawn page icons, which replace the
 * stock glyphs when "doodle icons in dock" is on. */
export const SPACES = [
  { route: "index", label: "Planner", doodle: "planner", sf: "checklist", md: "event-note" },
  { route: "boards", label: "Boards", doodle: "boards", sf: "square.on.square", md: "dashboard" },
  { route: "projects", label: "Projects", doodle: "learning", sf: "folder", md: "folder" },
  { route: "gym", label: "Gym", doodle: "gym", sf: "dumbbell", md: "fitness-center" },
  { route: "journal", label: "Journal", doodle: "journal", sf: "fork.knife", md: "restaurant" },
  { route: "account", label: "Account", doodle: "account", sf: "person.crop.circle", md: "person" },
] as const;

export type SpaceRoute = (typeof SPACES)[number]["route"];
export type Space = (typeof SPACES)[number];

/** The pinned ends. Everything else is the user's to arrange. */
export type DockChoice = Exclude<SpaceRoute, "index" | "account">;

/** The arrangeable middle, DERIVED from the registry rather than restated.
 * These were two hand-maintained lists that had to agree, and the only thing
 * enforcing that was a `!` in `spaceOf` — so a space added to one and not the
 * other became `undefined` in the dock and took the native tab bar down on the
 * first render after login. Deriving it makes that drift a type error. */
export const DOCK_CHOICES = SPACES.map((s) => s.route).filter(
  (r): r is DockChoice => r !== "index" && r !== "account",
);

/** Total by construction — an unknown route yields undefined rather than a
 * crash, so a stale persisted arrangement degrades to a missing tab. */
export function spaceOf(route: string): Space | undefined {
  return SPACES.find((s) => s.route === route);
}

/** The dock, resolved: the Planner pinned first, Account pinned last, the
 * user's visible middle spaces in their order between them. */
export function resolveDock(
  order: readonly DockChoice[],
  hidden: readonly DockChoice[],
): SpaceRoute[] {
  return ["index", ...order.filter((r) => !hidden.includes(r)), "account"];
}

/** A route name to its space. Every caller only ever passes either one of the
 * six tab routes themselves, or something else entirely (a shell page like
 * `style`, reached from Account) — detail pages (task, board, workout…) push
 * onto the root stack above the tab navigators, so they never reach this
 * function at all. Direct match, Account as the fallback, nothing more. */
export function spaceFor(routeName: string): SpaceRoute {
  if (SPACES.some((s) => s.route === routeName)) return routeName as SpaceRoute;
  return "account";
}
