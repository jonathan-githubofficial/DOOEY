# Home Space + User-Configurable Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 1 of [the spec](../specs/2026-07-26-home-dock-food-journal-design.md): Home becomes the first tab (a user-arranged widget stack with Schedule / Tasks / Gym widgets), Planner moves to its own route and opens on Week, and the dock becomes user-composable from a "Your dock" panel in Account.

**Architecture:** A new `features/home/` feature owns pure layout arithmetic (`layout.ts`, unit-tested), a persisted+synced shell store (`store.ts`), and the widgets. `lib/spaces.ts` stays the space registry and gains `resolveDock`/data-driven `spaceFor`. Both tab bars (native `NativeTabs`, web `Dock`) render from one `useDock()` hook. A shared `ArrangeList` component powers both the dock editor and Home's edit mode.

**Tech Stack:** Expo 54 / expo-router 6, React Native 0.81, zustand 5 (persist → AsyncStorage), TanStack Query 5, PocketBase (JS migrations in `backend/pb_migrations/`), react-native-gesture-handler + reanimated 4, jest-expo (new, this plan installs it).

## Global Constraints

- **Working directory:** all `npm`/`npx` commands run from `C:\Croesus\Central\Repos\test2\DOOEY\frontend` unless a step says otherwise. Repo root is `C:\Croesus\Central\Repos\test2\DOOEY`.
- **Branch `feat/expo-migration` has ~37 unrelated uncommitted files (gym work).** Every `git add` in this plan lists explicit paths. NEVER `git add -A` / `git add .`.
- **No AI attribution in commits** — no Co-Authored-By trailer, no "Generated with" line, no robot emoji (user's global rule).
- **Design system is law** (`docs/design-system.md`): colours only via `usePalette()` tokens + `alpha()`/`relight()`; type via `useType()`; shadows via `useElevation()`; card radii via `useCardRadius()`; motion via `src/lib/motion.ts` (`timing`, `settle`, `gesture.*` springs — springs ONLY while a finger drives the value; damping ratio ≥ 0.8; 220ms ceiling). No hex literals, no inline `withSpring` configs, no hand-written `shadowColor`.
- **zustand `partialize` is an allow-list**: any newly persisted field must appear in both the destructure and the returned object or it silently evaporates on reload (see `src/features/style/store.ts:135`).
- **Verification gates per task:** `npm run typecheck` and (where tests exist) `npx jest <file>`. There is no RTL/renderer test infra — UI tasks verify via typecheck + a manual web smoke test (`npx expo start --web`).
- **Import alias:** `@/` maps to `frontend/src/` (tsconfig paths). Match it in jest config.
- Copy the codebase's comment voice: comments explain constraints and jobs, not what the next line does.

---

### Task 1: Test rig + pure layout arithmetic

The repo has zero tests and no runner. Stand up jest-expo, then build the pure list logic every later task leans on: order normalization, item moves, hide toggles, dock resolution. Everything in `layout.ts` has zero imports so tests need no mocks.

**Files:**
- Modify: `frontend/package.json` (devDependencies, scripts, jest config)
- Create: `frontend/src/features/home/layout.ts`
- Test: `frontend/src/features/home/layout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DOCK_CHOICES: readonly ["planner","boards","projects","gym"]`, `type DockChoice`, `HOME_WIDGETS: readonly {key,label}[]`, `type WidgetKey ("schedule"|"tasks"|"gym")`, `normalizeOrder<T extends string>(saved: readonly string[] | null | undefined, all: readonly T[]): T[]`, `validKeys<T extends string>(saved: readonly string[] | undefined, all: readonly T[]): T[]`, `moveItem<T>(list: readonly T[], from: number, to: number): T[]`, `toggleKey<T extends string>(hidden: readonly T[], key: T): T[]`.

- [ ] **Step 1: Install jest-expo and add config**

```bash
npm install --save-dev jest-expo@~54.0.0 jest@~29.7.0 @types/jest@^29.5.0
```

Then in `frontend/package.json`, add to `"scripts"`:

```json
    "test": "jest"
```

and add a top-level `"jest"` key (sibling of `"scripts"`):

```json
  "jest": {
    "preset": "jest-expo",
    "moduleNameMapper": {
      "^@/(.*)$": "<rootDir>/src/$1"
    },
    "testMatch": ["**/src/**/*.test.ts"]
  }
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/features/home/layout.test.ts`:

```ts
import {
  DOCK_CHOICES,
  HOME_WIDGETS,
  moveItem,
  normalizeOrder,
  toggleKey,
  validKeys,
} from "./layout";

describe("normalizeOrder", () => {
  it("keeps a saved order, dropping unknowns and appending newcomers", () => {
    expect(normalizeOrder(["gym", "zombies", "planner"], DOCK_CHOICES)).toEqual([
      "gym",
      "planner",
      "boards",
      "projects",
    ]);
  });
  it("falls back to the canonical order when nothing was saved", () => {
    expect(normalizeOrder(null, DOCK_CHOICES)).toEqual([...DOCK_CHOICES]);
    expect(normalizeOrder(undefined, DOCK_CHOICES)).toEqual([...DOCK_CHOICES]);
  });
});

describe("validKeys", () => {
  it("filters a saved subset down to keys that still exist", () => {
    expect(validKeys(["projects", "gone"], DOCK_CHOICES)).toEqual(["projects"]);
    expect(validKeys(undefined, DOCK_CHOICES)).toEqual([]);
  });
});

describe("moveItem", () => {
  it("moves an item forward and backward", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("clamps an out-of-range target", () => {
    expect(moveItem(["a", "b"], 0, 99)).toEqual(["b", "a"]);
  });
});

describe("toggleKey", () => {
  it("adds a missing key and removes a present one", () => {
    expect(toggleKey([], "gym")).toEqual(["gym"]);
    expect(toggleKey(["gym"], "gym")).toEqual([]);
  });
});

describe("HOME_WIDGETS", () => {
  it("ships schedule, tasks and gym", () => {
    expect(HOME_WIDGETS.map((w) => w.key)).toEqual(["schedule", "tasks", "gym"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/features/home/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 4: Write the implementation**

Create `frontend/src/features/home/layout.ts`:

```ts
/** Pure list arithmetic for the two arrangeable surfaces — the dock and the
 * Home widget stack. Zero imports on purpose: this file is unit-tested and
 * everything shape-shifting about the shell funnels through it. */

/** The spaces the user may hide or reorder. Home and Account are pinned —
 * Home is the front door, Account holds the editor (you can't lock yourself
 * out). Food joins this list in phase 3. */
export const DOCK_CHOICES = ["planner", "boards", "projects", "gym"] as const;
export type DockChoice = (typeof DOCK_CHOICES)[number];

/** The Home widgets, in factory order. Grows in later phases (inbox, food). */
export const HOME_WIDGETS = [
  { key: "schedule", label: "Schedule" },
  { key: "tasks", label: "Tasks" },
  { key: "gym", label: "Gym" },
] as const;
export type WidgetKey = (typeof HOME_WIDGETS)[number]["key"];

/** Reconcile a saved order with the canonical set: keep the saved order for
 * keys that still exist, drop unknowns, append newcomers at the end — so an
 * app update that adds a space can't strand a stale persisted layout. */
export function normalizeOrder<T extends string>(
  saved: readonly string[] | null | undefined,
  all: readonly T[],
): T[] {
  const keep = (saved ?? []).filter((k): k is T => (all as readonly string[]).includes(k));
  const missing = all.filter((k) => !keep.includes(k));
  return [...keep, ...missing];
}

/** A saved subset (e.g. the hidden set), filtered to keys that still exist. */
export function validKeys<T extends string>(
  saved: readonly string[] | undefined,
  all: readonly T[],
): T[] {
  return (saved ?? []).filter((k): k is T => (all as readonly string[]).includes(k));
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

export function toggleKey<T extends string>(hidden: readonly T[], key: T): T[] {
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/features/home/layout.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
```

```bash
git add package.json package-lock.json src/features/home/layout.ts src/features/home/layout.test.ts
git commit -m "feat(home): test rig and pure shell-layout arithmetic"
```

---

### Task 2: Shell store + PocketBase migration

The persisted, synced source of truth for dock order/visibility and Home widget layout. Local persistence via zustand persist (`dooey-home`), cross-device sync via a single `shell` JSON field on the users record — the exact `savePageDoodles`/`syncFromUser` pattern from `src/features/style/store.ts:183-232`.

**Files:**
- Create: `frontend/src/features/home/store.ts`
- Create: `backend/pb_migrations/029_users_shell.js`

**Interfaces:**
- Consumes: Task 1's `layout.ts` exports; `pb` from `@/lib/pb`; `useAuthStore` from `@/stores/auth` (shape: `getState().user: RecordModel | null`, `getState().setUser(rec, token)`, `subscribe(listener)`).
- Produces: `useHomeStore` — state `{ dockOrder: DockChoice[]; dockHidden: DockChoice[]; widgetOrder: WidgetKey[]; widgetHidden: WidgetKey[]; editing: boolean }`, actions `setDock(order, hidden)`, `setWidgets(order, hidden)`, `setEditing(on)`. (Task 3 adds `useDock()` here once `spaces.ts` knows the new routes.)

- [ ] **Step 1: Write the store**

Create `frontend/src/features/home/store.ts`:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecordModel } from "pocketbase";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import {
  DOCK_CHOICES,
  HOME_WIDGETS,
  normalizeOrder,
  validKeys,
  type DockChoice,
  type WidgetKey,
} from "./layout";

const WIDGET_KEYS = HOME_WIDGETS.map((w) => w.key);

interface HomeStore {
  /** The user's order for the arrangeable middle of the dock. */
  dockOrder: DockChoice[];
  /** Spaces tucked out of the dock — still alive, just not on the bar. */
  dockHidden: DockChoice[];
  widgetOrder: WidgetKey[];
  widgetHidden: WidgetKey[];
  /** Home's arrange mode — session state, never persisted. */
  editing: boolean;
  setDock: (order: DockChoice[], hidden: DockChoice[]) => void;
  setWidgets: (order: WidgetKey[], hidden: WidgetKey[]) => void;
  setEditing: (on: boolean) => void;
}

export const useHomeStore = create<HomeStore>()(
  persist(
    (set) => ({
      dockOrder: [...DOCK_CHOICES],
      dockHidden: [],
      widgetOrder: [...WIDGET_KEYS],
      widgetHidden: [],
      editing: false,
      setDock: (dockOrder, dockHidden) => {
        set({ dockOrder, dockHidden });
        saveShell();
      },
      setWidgets: (widgetOrder, widgetHidden) => {
        set({ widgetOrder, widgetHidden });
        saveShell();
      },
      setEditing: (editing) => set({ editing }),
    }),
    {
      name: "dooey-home",
      storage: createJSONStorage(() => AsyncStorage),
      // The allow-list: a new persisted field must be added here too, or it
      // evaporates on reload (same trap as style/store.ts).
      partialize: ({ dockOrder, dockHidden, widgetOrder, widgetHidden }) => ({
        dockOrder,
        dockHidden,
        widgetOrder,
        widgetHidden,
      }),
    },
  ),
);

/** What the users.shell JSON field holds. */
interface ShellField {
  dockOrder?: string[];
  dockHidden?: string[];
  widgetOrder?: string[];
  widgetHidden?: string[];
}

/** Persist the arrangement onto the signed-in user's record so it follows the
 * account across devices — fire-and-forget like savePageDoodles: a failed
 * sync just leaves the local copy, retried on the next edit. */
function saveShell() {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const { dockOrder, dockHidden, widgetOrder, widgetHidden } = useHomeStore.getState();
  const shell: ShellField = { dockOrder, dockHidden, widgetOrder, widgetHidden };
  pb.collection("users")
    .update(user.id, { shell }, { requestKey: null })
    .then((rec) => useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token))
    .catch(() => {});
}

/** Pull the arrangement from a freshly loaded user record, reconciled against
 * the canonical sets so stale saves survive app updates. */
function syncFromUser(user: RecordModel | null) {
  const shell = (user?.shell as ShellField | null) ?? null;
  if (!shell) return;
  useHomeStore.setState({
    dockOrder: normalizeOrder(shell.dockOrder, DOCK_CHOICES),
    dockHidden: validKeys(shell.dockHidden, DOCK_CHOICES),
    widgetOrder: normalizeOrder(shell.widgetOrder, WIDGET_KEYS),
    widgetHidden: validKeys(shell.widgetHidden, WIDGET_KEYS),
  });
}

// Hydrate on boot (if already signed in) and whenever the user changes.
syncFromUser(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) syncFromUser(state.user);
});
```

- [ ] **Step 2: Write the migration**

Create `backend/pb_migrations/029_users_shell.js` (verify 029 is still the next free number: `ls backend/pb_migrations | sort | tail -3`):

```js
// The shell arrangement — dock order/visibility and the Home widget layout —
// lives on the user record so it follows the account across devices.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "shell" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("shell");
    app.save(users);
  },
);
```

Match the exact header/style of `backend/pb_migrations/014_users_page_doodles.js` (open it first — if it starts with a `/// <reference ...>` line, include the same line).

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: clean.

Run: `npx jest`
Expected: Task 1's suite still passes (the store file is not imported by any test — its module side effects need a live PocketBase and are exercised in the manual smoke tests).

- [ ] **Step 4: Commit**

```bash
git add src/features/home/store.ts ../backend/pb_migrations/029_users_shell.js
git commit -m "feat(home): shell store with local persistence and users.shell sync"
```

---

### Task 3: The frame — SPACES rework, Planner route move, dynamic tab bars

The one task where runtime behavior shifts, kept atomic so the app never sits broken between commits: `SPACES` gains `index`(Home)+`planner`, the Planner screen moves to its route, Home gets a placeholder screen, and both tab bars start rendering from `useDock()`.

**Files:**
- Modify: `frontend/src/lib/spaces.ts` (full rewrite below)
- Test: `frontend/src/lib/spaces.test.ts`
- Rename: `frontend/src/app/(tabs)/index.tsx` → `frontend/src/app/(tabs)/planner.tsx` (then edit)
- Create: `frontend/src/app/(tabs)/index.tsx` (new Home screen, placeholder body)
- Modify: `frontend/src/features/home/store.ts` (add `useDock()`)
- Modify: `frontend/src/app/(tabs)/_layout.tsx`
- Modify: `frontend/src/components/Dock.tsx`
- Modify: `frontend/src/features/workouts/components/LiveBarHost.tsx:8` (`TAB_PATHS`)
- Modify: `frontend/src/features/style/tokens.ts:229` (`DOODLE_PAGES` — add `home`)

**Interfaces:**
- Consumes: `resolveDock` shape decided here; `useHomeStore` from Task 2.
- Produces: `SPACES` (6 entries, routes `index|planner|boards|projects|gym|account`), `type SpaceRoute`, `type Space`, `spaceOf(route): Space`, `resolveDock(order, hidden): SpaceRoute[]`, `spaceFor(routeName): SpaceRoute`, `useDock(): Space[]` (resolved, pinned ends included). Route `/planner` (Planner, opens on Week), route `/` (Home).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/spaces.test.ts`:

```ts
import { resolveDock, spaceFor, SPACES } from "./spaces";

describe("SPACES", () => {
  it("leads with Home and ends with Account", () => {
    expect(SPACES[0].route).toBe("index");
    expect(SPACES[0].label).toBe("Home");
    expect(SPACES[SPACES.length - 1].route).toBe("account");
  });
  it("has a planner route for the calendar space", () => {
    expect(SPACES.map((s) => s.route)).toContain("planner");
  });
});

describe("resolveDock", () => {
  it("pins Home first and Account last around the visible middle", () => {
    expect(resolveDock(["planner", "boards", "projects", "gym"], [])).toEqual([
      "index",
      "planner",
      "boards",
      "projects",
      "gym",
      "account",
    ]);
  });
  it("drops hidden spaces but never the pinned ends", () => {
    expect(resolveDock(["planner", "boards", "projects", "gym"], ["boards", "projects"])).toEqual([
      "index",
      "planner",
      "gym",
      "account",
    ]);
  });
  it("respects a custom order", () => {
    expect(resolveDock(["gym", "planner", "boards", "projects"], ["projects"])).toEqual([
      "index",
      "gym",
      "planner",
      "boards",
      "account",
    ]);
  });
});

describe("spaceFor", () => {
  it("maps every space route to itself", () => {
    for (const s of SPACES) expect(spaceFor(s.route)).toBe(s.route);
  });
  it("keeps drill-ins lighting their parent stop", () => {
    expect(spaceFor("task/[id]")).toBe("planner");
    expect(spaceFor("compose")).toBe("planner");
    expect(spaceFor("board/[id]")).toBe("boards");
    expect(spaceFor("project/[id]")).toBe("projects");
    expect(spaceFor("workout/[id]")).toBe("gym");
    expect(spaceFor("routine/[id]")).toBe("gym");
  });
  it("falls back to account for shell pages", () => {
    expect(spaceFor("style")).toBe("account");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/spaces.test.ts`
Expected: FAIL — `SPACES[0].label` is `"Planner"`, `resolveDock` not exported.

- [ ] **Step 3: Rewrite `frontend/src/lib/spaces.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/spaces.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Move Planner to its route and open it on Week**

```bash
git mv "src/app/(tabs)/index.tsx" "src/app/(tabs)/planner.tsx"
```

In `frontend/src/app/(tabs)/planner.tsx`, change the mode initializer (currently line 71):

```ts
  const [mode, setMode] = useState<Mode>("agenda");
```
→
```ts
  // Home owns "today" now; the Planner is the calendar, so it opens on Week.
  const [mode, setMode] = useState<Mode>("week");
```

Everything else in the file stays as-is (the component keeps its `Planner` name).

- [ ] **Step 6: Create the Home screen (placeholder body — widgets land in Tasks 6–8)**

Create `frontend/src/app/(tabs)/index.tsx`. Mirror the page scaffolding of `src/app/(tabs)/account.tsx` (open it and copy its root-view/Grain/Masthead/ScrollView shell exactly — same imports, same `usePagePadding`/`useLiveBarInset` usage), with title `"Home"` and `<PageDoodle page="home" />` as the avatar:

```tsx
import { ScrollView, StyleSheet, View } from "react-native";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import { usePagePadding } from "@/lib/shell";
import { usePalette } from "@/stores/theme";

/** The front door: everything due today in one glance, arranged by you.
 * The widget stack lands here task by task — schedule, tasks, gym. */
export default function Home() {
  const colors = usePalette();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);

  return (
    <View style={[styles.root, { backgroundColor: colors.paper }]}>
      <Grain />
      <Masthead avatar={<PageDoodle page="home" />} title="Home" />
      <ScrollView contentContainerStyle={[styles.stack, { paddingBottom: page.paddingBottom }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { gap: 16, paddingHorizontal: 16, paddingTop: 8 },
});
```

(If `account.tsx`'s shell usage differs — e.g. `usePagePadding` returns something other than `{ paddingBottom }` — follow `account.tsx`, not this snippet.)

- [ ] **Step 7: Add `useDock()` to the shell store**

In `frontend/src/features/home/store.ts`, add to the imports:

```ts
import { useMemo } from "react";
import { resolveDock, spaceOf, type Space } from "@/lib/spaces";
```

and append at the end of the file:

```ts
/** The dock, resolved and joined with each space's facts, ready for either
 * tab bar to render. Pinned ends included. */
export function useDock(): Space[] {
  const order = useHomeStore((s) => s.dockOrder);
  const hidden = useHomeStore((s) => s.dockHidden);
  return useMemo(() => resolveDock(order, hidden).map(spaceOf), [order, hidden]);
}
```

- [ ] **Step 8: Render both tab bars from `useDock()`**

In `frontend/src/app/(tabs)/_layout.tsx`:

1. Add import: `import { useDock } from "@/features/home/store";`
2. Inside `TabsLayout()`, after the existing hooks: `const dock = useDock();`
3. Native branch: replace both `SPACES` walks with `dock` — the doodle loop (`for (const space of SPACES)` → `for (const space of dock)`) and the trigger list (`{SPACES.map((space) => ...)}` → `{dock.map((space) => ...)}`). Remove the now-unused `SPACES` import.
4. Web branch: register every space (this also fixes `gym`, which was already missing) —

```tsx
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="planner" options={{ title: "Planner" }} />
      <Tabs.Screen name="boards" options={{ title: "Boards" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="gym" options={{ title: "Gym" }} />
      <Tabs.Screen name="account" options={{ title: "Account" }} />
```

In `frontend/src/components/Dock.tsx`:

1. Imports: add `House` to the lucide import; add `import { useDock } from "@/features/home/store";`
2. Replace the module-level `DOCK_ICONS`/`DOCK_SPACES` block (lines 37–46) with:

```tsx
/** The dock's glyphs. The list of spaces itself lives in `lib/spaces` and the
 * user's arrangement in features/home/store; only the icons are the dock's
 * own business. Account is absent on purpose — your doodled self at the left
 * end of the island is its door. */
const DOCK_ICONS: Partial<Record<SpaceRoute, LucideIcon>> = {
  index: House,
  planner: NotebookPen,
  boards: Shapes,
  projects: FolderOpen,
  gym: Dumbbell,
};
```

3. Inside `Dock()`, derive the tabs reactively and re-seat the pill when the set changes (hidden tabs leave phantom entries in `stops.current` otherwise):

```tsx
  const dockSpaces = useDock().filter((s) => s.route !== "account");
  const dockKey = dockSpaces.map((s) => s.route).join(",");

  useEffect(() => {
    // Tabs were added/removed/reordered: drop stale stops and re-seat the pill
    // without animating — the bar itself just reflowed under it.
    const live = new Set([...dockSpaces.map((s) => s.route), "account"]);
    for (const key of Object.keys(stops.current)) if (!live.has(key)) delete stops.current[key];
    placed.current = false;
    place(active, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockKey]);
```

4. Replace `{DOCK_SPACES.map((space) => (` with `{dockSpaces.map((space) => (` in the render.

In `frontend/src/features/workouts/components/LiveBarHost.tsx`, update `TAB_PATHS` (line 8) to include the new route:

```ts
const TAB_PATHS = new Set(["/", "/planner", "/boards", "/projects", "/gym", "/account"]);
```

In `frontend/src/features/style/tokens.ts`, add Home to `DOODLE_PAGES` (line ~229), first entry:

```ts
export const DOODLE_PAGES = [
  { key: "home", label: "Home" },
  { key: "planner", label: "Planner" },
  ...
```

- [ ] **Step 9: Verify**

Run: `npm run typecheck` — expected clean.
Run: `npx jest` — expected: both suites pass.
Manual web smoke (`npx expo start --web`, sign in):
- Dock shows Home · Planner · Boards · Projects · Gym with the account cluster; Home is the `/` tab and renders its Masthead.
- Planner lives at `/planner`, opens on the Week view, and all four views still work.
- Creating a task from Planner's stamp FAB still works; opening a task keeps the Planner stop lit.
- Starting a gym session shows the live bar cleared of the dock on Home too.

- [ ] **Step 10: Commit**

```bash
git add src/lib/spaces.ts src/lib/spaces.test.ts "src/app/(tabs)/index.tsx" "src/app/(tabs)/planner.tsx" "src/app/(tabs)/_layout.tsx" src/components/Dock.tsx src/features/home/store.ts src/features/workouts/components/LiveBarHost.tsx src/features/style/tokens.ts
git commit -m "feat(shell): Home takes the front tab, Planner moves to /planner, dock renders from useDock()"
```

---

### Task 4: `ArrangeList` — the shared reorder/hide primitive

One component powers both editors (dock panel in Account, Home's arrange mode): a fixed-row-height list where hold-lifts a row (the app's convention — no drag handles, `activateAfterLongPress(220)` like `AgendaSheet.tsx:340`), neighbours displace live, and an eye toggles visibility.

**Files:**
- Create: `frontend/src/components/ArrangeList.tsx`

**Interfaces:**
- Consumes: `toggleKey` from `@/features/home/layout`; `gesture`, `timing`, `dur` from `@/lib/motion`; theme hooks.
- Produces: `ArrangeList({ items, order, hidden, onChange })` where `items: readonly ArrangeItem[]` (`{ key: string; label: string; icon?: ReactNode }`), `order: readonly string[]`, `hidden: readonly string[]`, `onChange(order: string[], hidden: string[]): void`. Also exports `ROW_H = 52`.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/ArrangeList.tsx`:

```tsx
import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Eye, EyeOff } from "lucide-react-native";
import { hapticTap } from "@/lib/haptics";
import { dur, gesture, timing } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { toggleKey } from "@/features/home/layout";

export const ROW_H = 52;

export interface ArrangeItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

/** A short list the user owns: hold a row to lift and reorder it (the app's
 * hold-to-lift convention — no handles), tap the eye to tuck it away. Fixed
 * row height keeps the slot math trivial; both the dock editor and Home's
 * arrange mode are this component. */
export function ArrangeList({
  items,
  order,
  hidden,
  onChange,
}: {
  items: readonly ArrangeItem[];
  order: readonly string[];
  hidden: readonly string[];
  onChange: (order: string[], hidden: string[]) => void;
}) {
  // Rows read their slot from this shared map so a drag displaces neighbours
  // live — AgendaSheet's ReorderableRows pattern, minus variable heights.
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(order.map((k, i) => [k, i])),
  );
  const orderKey = order.join(",");

  useEffect(() => {
    positions.value = Object.fromEntries(order.map((k, i) => [k, i]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey]);

  const commit = () => {
    const next = [...order].sort(
      (a, b) => (positions.value[a] ?? 0) - (positions.value[b] ?? 0),
    );
    onChange(next, [...hidden]);
  };

  return (
    <View style={{ height: order.length * ROW_H }}>
      {order.map((key) => {
        const item = items.find((i) => i.key === key);
        if (!item) return null;
        return (
          <Row
            key={key}
            item={item}
            positions={positions}
            count={order.length}
            hidden={hidden.includes(key)}
            onToggle={() => {
              hapticTap();
              onChange([...order], toggleKey([...hidden], key));
            }}
            onDrop={commit}
          />
        );
      })}
    </View>
  );
}

function Row({
  item,
  positions,
  count,
  hidden,
  onToggle,
  onDrop,
}: {
  item: ArrangeItem;
  positions: SharedValue<Record<string, number>>;
  count: number;
  hidden: boolean;
  onToggle: () => void;
  onDrop: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const dragging = useSharedValue(false);
  const y = useSharedValue((positions.value[item.key] ?? 0) * ROW_H);
  const startY = useSharedValue(0);

  // Follow the slot map whenever this row isn't the one being held.
  useAnimatedReaction(
    () => positions.value[item.key],
    (slot) => {
      if (slot != null && !dragging.value) y.value = withTiming(slot * ROW_H, timing());
    },
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      dragging.value = true;
      startY.value = (positions.value[item.key] ?? 0) * ROW_H;
      y.value = startY.value;
      runOnJS(hapticTap)();
    })
    .onUpdate((e) => {
      y.value = startY.value + e.translationY;
      const slot = Math.max(0, Math.min(count - 1, Math.round(y.value / ROW_H)));
      const current = positions.value[item.key] ?? 0;
      if (slot === current) return;
      const next = { ...positions.value };
      for (const k in next) {
        if (k === item.key) continue;
        if (current < slot && next[k] > current && next[k] <= slot) next[k] -= 1;
        else if (current > slot && next[k] >= slot && next[k] < current) next[k] += 1;
      }
      next[item.key] = slot;
      positions.value = next;
    })
    .onEnd(() => {
      // The finger let go: a gesture spring seats the row in its slot.
      y.value = withSpring((positions.value[item.key] ?? 0) * ROW_H, gesture.snap);
      runOnJS(onDrop)();
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { scale: withTiming(dragging.value ? 1.02 : 1, timing(dur.instant)) },
    ],
    zIndex: dragging.value ? 2 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.row, style]}>
        {item.icon}
        <Text
          numberOfLines={1}
          style={[type.sansMedium, styles.label, { color: colors.ink }, hidden && styles.dimmed]}
        >
          {item.label}
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: !hidden }}
          accessibilityLabel={`Show ${item.label} in the dock`}
          onPress={onToggle}
          hitSlop={8}
          style={styles.eye}
        >
          {hidden ? (
            <EyeOff size={18} color={alpha(colors.inkMuted, 0.7)} />
          ) : (
            <Eye size={18} color={colors.inkMuted} />
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ROW_H,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: { flex: 1, fontSize: 15 },
  dimmed: { opacity: 0.45 },
  eye: { padding: 6 },
});
```

Before writing, check `src/lib/haptics` exists with `hapticTap` (grep: `grep -rn "hapticTap" frontend/src/lib/`); if it lives elsewhere (e.g. `@/lib/haptic`), match the real path — every feature file imports it from somewhere, copy their import line.

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: clean. (No renderer tests exist; the component is exercised manually in Tasks 5 and 9.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ArrangeList.tsx
git commit -m "feat(shell): ArrangeList, the shared hold-to-reorder + hide primitive"
```

---

### Task 5: "Your dock" panel in Account

The editor itself: a Panel in Account (so the real tab bar stays visible and updates live while you toggle — the Style-studio feel, no save button).

**Files:**
- Create: `frontend/src/features/home/components/DockPanel.tsx`
- Modify: `frontend/src/app/(tabs)/account.tsx` (import + mount)

**Interfaces:**
- Consumes: `ArrangeList` (Task 4), `useHomeStore.setDock` (Task 2), `spaceOf` (Task 3).
- Produces: `DockPanel()` — self-contained, no props.

- [ ] **Step 1: Write the panel**

Create `frontend/src/features/home/components/DockPanel.tsx`:

```tsx
import { StyleSheet, Text } from "react-native";
import { Dumbbell, FolderOpen, NotebookPen, Shapes } from "lucide-react-native";
import { ArrangeList } from "@/components/ArrangeList";
import { Eyebrow, Panel } from "@/components/surface";
import { spaceOf } from "@/lib/spaces";
import { usePalette, useType } from "@/stores/theme";
import type { DockChoice } from "../layout";
import { useHomeStore } from "../store";

const ICONS = {
  planner: NotebookPen,
  boards: Shapes,
  projects: FolderOpen,
  gym: Dumbbell,
} as const;

/** The dock belongs to the user: reorder the middle spaces, tuck away the
 * ones you don't visit. Changes land on the bar as you make them — Home and
 * Account are pinned so you can never lock yourself out. */
export function DockPanel() {
  const colors = usePalette();
  const type = useType();
  const order = useHomeStore((s) => s.dockOrder);
  const hidden = useHomeStore((s) => s.dockHidden);
  const setDock = useHomeStore((s) => s.setDock);

  return (
    <Panel style={styles.panel}>
      <Eyebrow>your dock</Eyebrow>
      <Text style={[type.sans, styles.hint, { color: colors.inkMuted }]}>
        Hold to reorder, tap the eye to tuck a space away. Home and Account stay put.
      </Text>
      <ArrangeList
        items={order.map((r) => {
          const Icon = ICONS[r];
          return {
            key: r,
            label: spaceOf(r).label,
            icon: <Icon size={18} color={colors.inkMuted} />,
          };
        })}
        order={order}
        hidden={hidden}
        onChange={(o, h) => setDock(o as DockChoice[], h as DockChoice[])}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  hint: { fontSize: 13, lineHeight: 18 },
});
```

- [ ] **Step 2: Mount it in Account**

In `frontend/src/app/(tabs)/account.tsx`:
- Add `import { DockPanel } from "@/features/home/components/DockPanel";`
- Mount `<DockPanel />` after the Preferences card (the `PressableScale` block ending near line 116) and before `<GardenPanel />` (line ~118).

- [ ] **Step 3: Verify**

Run: `npm run typecheck` — expected clean.
Manual web smoke:
- Account shows the "your dock" panel with Planner/Boards/Projects/Gym rows.
- Tapping an eye removes/restores that tab on the dock immediately.
- Hold-drag reorders rows; the dock reorders to match; the sliding pill stays under the active tab.
- Reload the page: the arrangement survives (local persist) — and check the PB admin UI (or network tab) shows a `users` PATCH with the `shell` field (sync).

- [ ] **Step 4: Commit**

```bash
git add src/features/home/components/DockPanel.tsx "src/app/(tabs)/account.tsx"
git commit -m "feat(shell): Your dock panel in Account — reorder and hide spaces live"
```

---

### Task 6: `HomeWidget` shell + Tasks widget + the widget stack

The block primitive every widget wears, the first (highest-value) widget, and the Home screen rendering the stack from the store. Actions complete in place: check off without navigating, long-press to timebox via the app's sheet.

**Files:**
- Create: `frontend/src/features/home/components/HomeWidget.tsx`
- Create: `frontend/src/features/home/components/TasksTodayWidget.tsx`
- Modify: `frontend/src/app/(tabs)/index.tsx` (render the stack + compose FAB)

**Interfaces:**
- Consumes: `useDayTasks(date)`, `useUpdateTask()` from `@/features/tasks/api` (mutation input `{ id, patch: TaskPatch }`); `Check` (`@/components/Check`, props `{ done, onToggle, label, size? }`); `openSheet({ title?, actions: SheetAction[] })` from `@/stores/sheet`; `localDate`, `dateOnly` from `@/lib/dates`; `TaskComposer` from `@/features/tasks/components/TaskComposer` (prop `date`).
- Produces: `HomeWidget({ title, children })`; `TasksTodayWidget()`; a `WIDGET_VIEWS: Partial<Record<WidgetKey, ComponentType>>` registry in the Home screen that Tasks 7–8 extend.

- [ ] **Step 1: Write the shell**

Create `frontend/src/features/home/components/HomeWidget.tsx`:

```tsx
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Eyebrow, Panel } from "@/components/surface";

/** The one shell every Home block wears — a Panel led by an eyebrow — so the
 * stack reads as one system no matter what each widget holds. */
export function HomeWidget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel style={styles.panel}>
      <Eyebrow>{title}</Eyebrow>
      <View style={styles.body}>{children}</View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12 },
  body: { gap: 2 },
});
```

- [ ] **Step 2: Write the Tasks widget**

Create `frontend/src/features/home/components/TasksTodayWidget.tsx`:

```tsx
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "@/components/Check";
import { useDayTasks, useUpdateTask } from "@/features/tasks/api";
import type { Task } from "@/features/tasks/types";
import { dateOnly, localDate } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { openSheet } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { HomeWidget } from "./HomeWidget";

const SHOW = 8;

/** Days a task has been waiting past its due date. 0 = due today or undated. */
function ageDays(due: string): number {
  if (!due) return 0;
  const ms =
    new Date(`${localDate()}T00:00:00`).getTime() -
    new Date(`${dateOnly(due)}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

const SLOTS = [
  { label: "Morning · 9:00", start: 9 * 60 },
  { label: "Midday · 12:00", start: 12 * 60 },
  { label: "Afternoon · 3:00", start: 15 * 60 },
  { label: "Evening · 6:00", start: 18 * 60 },
];

/** Today's open tasks, actionable in place: tick the box to finish, tap to
 * open, hold to drop it onto today's timeline. Overdue tasks surface here by
 * themselves (the day query has no lower bound) wearing their age. */
export function TasksTodayWidget() {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: tasks = [] } = useDayTasks(localDate());
  const update = useUpdateTask();

  const open = tasks.filter((t) => !t.done_at);
  const shown = open.slice(0, SHOW);

  const timebox = (task: Task) =>
    openSheet({
      title: task.title,
      actions: [
        ...SLOTS.map((s) => ({
          label: s.label,
          onPress: () =>
            update.mutate({
              id: task.id,
              patch: { start_min: s.start, dur_min: task.dur_min || 60 },
            }),
        })),
        ...(task.start_min > 0
          ? [
              {
                label: "Unschedule",
                destructive: true,
                onPress: () => update.mutate({ id: task.id, patch: { start_min: 0 } }),
              },
            ]
          : []),
      ],
    });

  return (
    <HomeWidget title="tasks">
      {open.length === 0 && (
        <Text style={[type.sans, styles.empty, { color: colors.inkMuted }]}>
          All clear — nothing waiting today.
        </Text>
      )}
      {shown.map((task) => {
        const age = ageDays(task.due_date);
        return (
          <Pressable
            key={task.id}
            style={styles.row}
            onPress={() => router.push({ pathname: "/task/[id]", params: { id: task.id } })}
            onLongPress={() => timebox(task)}
          >
            <Check
              done={false}
              label={task.title}
              onToggle={() =>
                update.mutate({ id: task.id, patch: { done_at: new Date().toISOString() } })
              }
            />
            <Text numberOfLines={1} style={[type.sans, styles.title, { color: colors.ink }]}>
              {task.title}
            </Text>
            {age > 0 && (
              <View style={[styles.age, { backgroundColor: alpha(colors.clay, 0.15) }]}>
                <Text style={[type.sansMedium, styles.ageText, { color: colors.clay }]}>
                  {age}d
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
      {open.length > SHOW && (
        <Pressable onPress={() => router.push("/planner")}>
          <Text style={[type.sansMedium, styles.more, { color: colors.inkMuted }]}>
            +{open.length - SHOW} more in Planner
          </Text>
        </Pressable>
      )}
    </HomeWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  title: { flex: 1, fontSize: 15 },
  // A pill like AgendaSheet's DueChip — fully-round chips are shape, not a
  // card radius, so the Style slider rightly doesn't own them.
  age: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  ageText: { fontSize: 11 },
  empty: { fontSize: 14, paddingVertical: 4 },
  more: { fontSize: 13, paddingTop: 6 },
});
```

- [ ] **Step 3: Render the stack on Home**

Replace the body of `frontend/src/app/(tabs)/index.tsx` with the widget stack (registry pattern — Tasks 7–8 each add one line):

```tsx
import type { ComponentType } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { TasksTodayWidget } from "@/features/home/components/TasksTodayWidget";
import { useHomeStore } from "@/features/home/store";
import type { WidgetKey } from "@/features/home/layout";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { TaskComposer } from "@/features/tasks/components/TaskComposer";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import { localDate } from "@/lib/dates";
import { usePagePadding } from "@/lib/shell";
import { usePalette } from "@/stores/theme";

/** Widgets register here as they land; a key the registry doesn't know yet
 * simply doesn't render, so the persisted order can run ahead of the code. */
const WIDGET_VIEWS: Partial<Record<WidgetKey, ComponentType>> = {
  tasks: TasksTodayWidget,
};

/** The front door: everything due today in one glance, arranged by you. */
export default function Home() {
  const colors = usePalette();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);
  const order = useHomeStore((s) => s.widgetOrder);
  const hidden = useHomeStore((s) => s.widgetHidden);

  return (
    <View style={[styles.root, { backgroundColor: colors.paper }]}>
      <Grain />
      <Masthead avatar={<PageDoodle page="home" />} title="Home" />
      <ScrollView contentContainerStyle={[styles.stack, { paddingBottom: page.paddingBottom }]}>
        {order
          .filter((key) => !hidden.includes(key))
          .map((key) => {
            const Widget = WIDGET_VIEWS[key];
            return Widget ? <Widget key={key} /> : null;
          })}
      </ScrollView>
      <TaskComposer date={localDate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { gap: 16, paddingHorizontal: 16, paddingTop: 8 },
});
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck` — expected clean.
Manual web smoke:
- Home shows the tasks widget with today's open tasks (including any overdue, wearing `Nd` chips).
- Ticking a box completes the task in place — and it's also gone from Planner's agenda (shared query cache).
- Tap opens the task page; hold opens the timebox sheet; picking "Morning · 9:00" schedules it (visible in Planner's Day view at 9:00).
- The stamp FAB composes a task for today.

- [ ] **Step 5: Commit**

```bash
git add src/features/home/components/HomeWidget.tsx src/features/home/components/TasksTodayWidget.tsx "src/app/(tabs)/index.tsx"
git commit -m "feat(home): widget stack with the tasks-today widget and compose FAB"
```

---

### Task 7: Schedule widget

Today's timeboxes as a glanceable list with a "now" rule, plus the live gym session when one is running. External calendar events will join this list when sync lands — the row model (time + title) is already theirs; no visible placeholder.

**Files:**
- Create: `frontend/src/features/home/components/ScheduleWidget.tsx`
- Modify: `frontend/src/app/(tabs)/index.tsx` (register)

**Interfaces:**
- Consumes: `useDayTasks`, `fmtMin` from `@/features/tasks/timeGrid` (`fmtMin(min: number): string` → "7:30a"), `useLiveWorkout()` from `@/features/workouts/api`, `useNow(intervalMs)` from `@/features/workouts/clock` (returns epoch ms, ticking).
- Produces: `ScheduleWidget()`.

- [ ] **Step 1: Write the widget**

Create `frontend/src/features/home/components/ScheduleWidget.tsx`:

```tsx
import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDayTasks } from "@/features/tasks/api";
import { fmtMin } from "@/features/tasks/timeGrid";
import { useLiveWorkout } from "@/features/workouts/api";
import { useNow } from "@/features/workouts/clock";
import { localDate } from "@/lib/dates";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { HomeWidget } from "./HomeWidget";

/** Today's timeboxes in one glance, with a zest rule marking now. External
 * calendar events will join this list when sync lands — the row model
 * (time + title) is already theirs. */
export function ScheduleWidget() {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: tasks = [] } = useDayTasks(localDate());
  const live = useLiveWorkout();
  const now = new Date(useNow(30_000));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const scheduled = tasks
    .filter((t) => !t.done_at && t.start_min > 0)
    .sort((a, b) => a.start_min - b.start_min);

  let nowDrawn = false;
  return (
    <HomeWidget title="schedule">
      {scheduled.length === 0 && !live && (
        <Pressable onPress={() => router.push("/planner")}>
          <Text style={[type.sans, styles.empty, { color: colors.inkMuted }]}>
            Nothing timeboxed — plan the day in Planner.
          </Text>
        </Pressable>
      )}
      {scheduled.map((t) => {
        const past = t.start_min + (t.dur_min || 60) < nowMin;
        const rule = !nowDrawn && t.start_min >= nowMin;
        if (rule) nowDrawn = true;
        return (
          <Fragment key={t.id}>
            {rule && <View style={[styles.nowRule, { backgroundColor: colors.zest }]} />}
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: "/task/[id]", params: { id: t.id } })}
            >
              <Text
                style={[
                  type.sansMedium,
                  styles.time,
                  { color: past ? colors.inkMuted : colors.zest },
                ]}
              >
                {fmtMin(t.start_min)}
              </Text>
              <Text
                numberOfLines={1}
                style={[type.sans, styles.title, { color: past ? colors.inkMuted : colors.ink }]}
              >
                {t.title}
              </Text>
            </Pressable>
          </Fragment>
        );
      })}
      {scheduled.length > 0 && !nowDrawn && (
        <View style={[styles.nowRule, { backgroundColor: colors.zest }]} />
      )}
      {live && (
        <Pressable
          style={[styles.liveRow, { backgroundColor: alpha(colors.zest, 0.12) }]}
          onPress={() => router.push({ pathname: "/workout/[id]", params: { id: live.id } })}
        >
          <Text style={[type.sansMedium, styles.liveText, { color: colors.zest }]}>
            Gym session live — {live.title}
          </Text>
        </Pressable>
      )}
    </HomeWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  time: { fontSize: 13, width: 52, textAlign: "right" },
  title: { flex: 1, fontSize: 15 },
  nowRule: { height: 2, borderRadius: 1, marginVertical: 2 },
  liveRow: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
  liveText: { fontSize: 13 },
  empty: { fontSize: 14, paddingVertical: 4 },
});
```

- [ ] **Step 2: Register it**

In `frontend/src/app/(tabs)/index.tsx`, add the import and registry line:

```tsx
import { ScheduleWidget } from "@/features/home/components/ScheduleWidget";
```
```tsx
const WIDGET_VIEWS: Partial<Record<WidgetKey, ComponentType>> = {
  schedule: ScheduleWidget,
  tasks: TasksTodayWidget,
};
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck` — expected clean.
Manual web smoke: timebox two tasks (one past, one upcoming) — the past one is muted, the zest rule sits between them, tapping a row opens the task. Start a gym session — the live row appears and opens the logger.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/components/ScheduleWidget.tsx "src/app/(tabs)/index.tsx"
git commit -m "feat(home): schedule widget — today's timeboxes with a now rule"
```

---

### Task 8: Gym widget

The routine on deck (the rotation's suggestion) with one-tap start into the live logger; a resume row while a session runs.

**Files:**
- Create: `frontend/src/features/home/components/GymTodayWidget.tsx`
- Modify: `frontend/src/app/(tabs)/index.tsx` (register)

**Interfaces:**
- Consumes: `useRoutines()`, `useWorkoutPrograms()`, `useWorkouts()`, `useLiveWorkout()`, `useStartWorkout()` from `@/features/workouts/api` (`useStartWorkout().mutate(routine: RoutineTemplate | null, { onSuccess: (w: Workout) => ... })`); `nextUp(routines, programs, workouts): Routine | null`, `lastDoneAt(routineId, workouts): string | null`, `sinceLabel(iso): string` from `@/features/workouts/rotation`; `StampButton` from `@/components/surface`.
- Produces: `GymTodayWidget()`.

- [ ] **Step 1: Write the widget**

Create `frontend/src/features/home/components/GymTodayWidget.tsx`:

```tsx
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StampButton } from "@/components/surface";
import {
  useLiveWorkout,
  useRoutines,
  useStartWorkout,
  useWorkoutPrograms,
  useWorkouts,
} from "@/features/workouts/api";
import { lastDoneAt, nextUp, sinceLabel } from "@/features/workouts/rotation";
import { usePalette, useType } from "@/stores/theme";
import { HomeWidget } from "./HomeWidget";

/** The routine on deck — the rotation's suggestion — one tap from logging
 * set one. While a session runs, this is the way back into it. */
export function GymTodayWidget() {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: routines = [] } = useRoutines();
  const { data: programs = [] } = useWorkoutPrograms();
  const { data: workouts = [] } = useWorkouts();
  const live = useLiveWorkout();
  const start = useStartWorkout();

  const openWorkout = (id: string) =>
    router.push({ pathname: "/workout/[id]", params: { id } });

  if (live) {
    return (
      <HomeWidget title="gym">
        <View style={styles.row}>
          <View style={styles.text}>
            <Text style={[type.display, styles.name, { color: colors.ink }]}>{live.title}</Text>
            <Text style={[type.sans, styles.sub, { color: colors.inkMuted }]}>
              Session in progress
            </Text>
          </View>
          <StampButton onPress={() => openWorkout(live.id)}>Resume</StampButton>
        </View>
      </HomeWidget>
    );
  }

  const routine = nextUp(routines, programs, workouts);
  if (!routine) {
    return (
      <HomeWidget title="gym">
        <Pressable onPress={() => router.push("/gym")}>
          <Text style={[type.sans, styles.sub, { color: colors.inkMuted }]}>
            No routines yet — set up your program in Gym.
          </Text>
        </Pressable>
      </HomeWidget>
    );
  }

  const program = programs.find((p) => p.id === routine.program);
  const last = lastDoneAt(routine.id, workouts);
  const since = last ? sinceLabel(last) : "not trained yet";

  return (
    <HomeWidget title="gym">
      <View style={styles.row}>
        <Pressable
          style={styles.text}
          onPress={() => router.push({ pathname: "/routine/[id]", params: { id: routine.id } })}
        >
          <Text style={[type.display, styles.name, { color: colors.ink }]}>{routine.name}</Text>
          <Text style={[type.sans, styles.sub, { color: colors.inkMuted }]}>
            {[program?.name, since].filter(Boolean).join(" · ")}
          </Text>
        </Pressable>
        <StampButton
          onPress={() =>
            live ? openWorkout(live.id) : start.mutate(routine, { onSuccess: (w) => openWorkout(w.id) })
          }
        >
          Start
        </StampButton>
      </View>
    </HomeWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 18 },
  sub: { fontSize: 13 },
});
```

(Check `sinceLabel`'s null-handling in `src/features/workouts/rotation.ts:65` before relying on the guard — if it already accepts null, drop the ternary and pass through.)

- [ ] **Step 2: Register it**

In `frontend/src/app/(tabs)/index.tsx`:

```tsx
import { GymTodayWidget } from "@/features/home/components/GymTodayWidget";
```
```tsx
const WIDGET_VIEWS: Partial<Record<WidgetKey, ComponentType>> = {
  schedule: ScheduleWidget,
  tasks: TasksTodayWidget,
  gym: GymTodayWidget,
};
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck` — expected clean.
Manual web smoke: the widget names the same routine as the Gym tab's UpNext hero; Start opens the live logger with that routine's exercises; back on Home the widget shows Resume; the Gym tab shows the same live session.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/components/GymTodayWidget.tsx "src/app/(tabs)/index.tsx"
git commit -m "feat(home): gym widget — the routine on deck, one tap from set one"
```

---

### Task 9: Home arrange mode

The pencil in Home's masthead toggles arrange mode: an ArrangeList panel appears above the stack, the widgets below reflect every change live.

**Files:**
- Modify: `frontend/src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `ArrangeList` (Task 4), `HOME_WIDGETS`/`WidgetKey` (Task 1), `useHomeStore.setWidgets`/`editing`/`setEditing` (Task 2), `PressableScale` from `@/components/pressable-scale`, `Panel`/`Eyebrow` from `@/components/surface`.
- Produces: nothing new — completes the Home screen.

- [ ] **Step 1: Wire the arrange mode**

In `frontend/src/app/(tabs)/index.tsx`, extend the imports:

```tsx
import { Check as CheckIcon, Pencil } from "lucide-react-native";
import { ArrangeList } from "@/components/ArrangeList";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { HOME_WIDGETS } from "@/features/home/layout";
```

pull the extra store state inside `Home()`:

```tsx
  const editing = useHomeStore((s) => s.editing);
  const setEditing = useHomeStore((s) => s.setEditing);
  const setWidgets = useHomeStore((s) => s.setWidgets);
```

give the masthead the pencil (as `Masthead`'s children — its right-side action slot):

```tsx
      <Masthead avatar={<PageDoodle page="home" />} title="Home">
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={editing ? "Done arranging" : "Arrange Home"}
          onPress={() => setEditing(!editing)}
        >
          {editing ? (
            <CheckIcon size={20} color={colors.zest} />
          ) : (
            <Pencil size={20} color={colors.inkMuted} />
          )}
        </PressableScale>
      </Masthead>
```

and put the arrange panel at the top of the ScrollView, before the widget loop:

```tsx
        {editing && (
          <Panel style={styles.arrange}>
            <Eyebrow>arrange</Eyebrow>
            <ArrangeList
              items={HOME_WIDGETS.map((w) => ({ key: w.key, label: w.label }))}
              order={order}
              hidden={hidden}
              onChange={(o, h) => setWidgets(o as WidgetKey[], h as WidgetKey[])}
            />
          </Panel>
        )}
```

with the style entry:

```tsx
  arrange: { gap: 12 },
```

(If `PressableScale` doesn't pass through accessibility props, wrap a plain `Pressable` around the icon instead — check `src/components/pressable-scale.tsx` first.)

- [ ] **Step 2: Verify**

Run: `npm run typecheck` — expected clean.
Manual web smoke: pencil toggles the arrange panel; dragging Schedule below Tasks reorders the live stack beneath; hiding Gym removes its widget; reload — the arrangement survives.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(tabs)/index.tsx"
git commit -m "feat(home): arrange mode — reorder and hide widgets from the masthead pencil"
```

---

### Task 10: Design check, full verification, docs

**Files:**
- Modify: `CLAUDE.md` (repo root — the "Current state" block)
- Modify: `docs/roadmap.md` (only if it lists phase-1 items this plan shipped)

- [ ] **Step 1: Run the design-system check**

Invoke the `design-check` skill over the new/changed UI files (`ArrangeList.tsx`, `DockPanel.tsx`, `HomeWidget.tsx`, `TasksTodayWidget.tsx`, `ScheduleWidget.tsx`, `GymTodayWidget.tsx`, `(tabs)/index.tsx`, `Dock.tsx` diff). Fix anything it flags (stray literals, spring misuse, radii the Style slider can't reach) and amend within this task.

- [ ] **Step 2: Full gates**

```bash
npm run typecheck
```
```bash
npm run lint
```
```bash
npx jest
```
Expected: all clean/passing.

- [ ] **Step 3: Full manual pass (web)**

`npx expo start --web`, signed in:
1. Dock: Home · Planner · Boards · Projects · Gym · account cluster; hide Projects from Account → gone from dock; restore it; reorder Gym first → dock follows.
2. Home: all three widgets; check a task off; timebox one by holding; start the gym routine; resume it from Home.
3. Planner at `/planner` opens on Week; Agenda/Day/Month all work; compose FAB works on both Home and Planner.
4. Dark mode: flip the theme in Account — no stuck light colours on any new surface.
5. Style studio: drag the radius slider — every new Panel corner follows.

Note in the commit message that native (iOS/Android dev client) still needs a device pass — the NativeTabs trigger set changing at runtime (hiding a space) is the specific thing to verify there.

- [ ] **Step 4: Update the docs**

In `CLAUDE.md`, update the **Current state** block (it must stay true — this is the repo's rule): Home is the first tab (widget stack: schedule/tasks/gym, arrange mode), Planner is `/planner` opening on Week, dock is user-configurable from Account (`users.shell` field, migration 029), jest-expo now exists (`npm test`), phase 2 (capture/inbox/search) and 3 (food) of the spec are next. Update **The spaces** section (six spaces, dock configurable).

- [ ] **Step 5: Commit**

```bash
git add ../CLAUDE.md ../docs/roadmap.md
git commit -m "docs: record Home space, configurable dock, and test rig in project docs"
```
(Drop `../docs/roadmap.md` from the add if unchanged.)
