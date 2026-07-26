import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecordModel } from "pocketbase";
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pb } from "@/lib/pb";
import { resolveDock, spaceOf, type Space } from "@/lib/spaces";
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

/** The dock, resolved and joined with each space's facts, ready for either
 * tab bar to render. Pinned ends included. */
export function useDock(): Space[] {
  const order = useHomeStore((s) => s.dockOrder);
  const hidden = useHomeStore((s) => s.dockHidden);
  return useMemo(() => resolveDock(order, hidden).map(spaceOf), [order, hidden]);
}
