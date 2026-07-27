import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecordModel } from "pocketbase";
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pb } from "@/lib/pb";
import { DOCK_CHOICES, resolveDock, spaceOf, type DockChoice, type Space } from "@/lib/spaces";
import { useAuthStore } from "@/stores/auth";
import { normalizeOrder, validKeys } from "./layout";

/** What the users.shell JSON field holds. */
interface ShellField {
  dockOrder?: string[];
  dockHidden?: string[];
}

interface HomeStore {
  /** The user's order for the arrangeable middle of the dock. */
  dockOrder: DockChoice[];
  /** Spaces tucked out of the dock — still alive, just not on the bar. */
  dockHidden: DockChoice[];
  setDock: (order: DockChoice[], hidden: DockChoice[]) => void;
}

export const useHomeStore = create<HomeStore>()(
  persist(
    (set) => ({
      dockOrder: [...DOCK_CHOICES],
      dockHidden: [],
      setDock: (dockOrder, dockHidden) => {
        set({ dockOrder, dockHidden });
        saveShell();
      },
    }),
    {
      name: "dooey-home",
      storage: createJSONStorage(() => AsyncStorage),
      // The allow-list: a new persisted field must be added here too, or it
      // evaporates on reload (same trap as style/store.ts).
      partialize: ({ dockOrder, dockHidden }) => ({ dockOrder, dockHidden }),
      // Ordering contract: this local copy is only a fast-boot cache, so the
      // dock and widget stack have something to render before AsyncStorage's
      // read and the users.shell record both resolve. The record wins
      // whenever it exists — merge just normalizes the local copy against the
      // canonical sets on the way in, and onRehydrateStorage re-applies the
      // signed-in user's record right after local storage lands, so a stale
      // local write can never outlive the account's own record.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ShellField>;
        return {
          ...current,
          dockOrder: normalizeOrder(p.dockOrder, DOCK_CHOICES),
          dockHidden: validKeys(p.dockHidden, DOCK_CHOICES),
        };
      },
      onRehydrateStorage: () => () => syncFromUser(useAuthStore.getState().user),
    },
  ),
);

/** Persist the arrangement onto the signed-in user's record so it follows the
 * account across devices — fire-and-forget like savePageDoodles: a failed
 * sync just leaves the local copy, retried on the next edit. */
function saveShell() {
  const user = useAuthStore.getState().user;
  if (!user) return;
  const { dockOrder, dockHidden } = useHomeStore.getState();
  const shell: ShellField = { dockOrder, dockHidden };
  pb.collection("users")
    .update(user.id, { shell }, { requestKey: null })
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
  });
}

// Hydrate on boot (if already signed in) and whenever the user changes. This
// runs synchronously, ahead of AsyncStorage's async rehydration — the
// persist middleware's onRehydrateStorage callback above re-runs this same
// sync once local storage lands, so whichever finishes last, the record wins.
syncFromUser(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) syncFromUser(state.user);
});

/** The dock, resolved and joined with each space's facts, ready for either
 * tab bar to render. Pinned ends included. */
export function useDock(): Space[] {
  const order = useHomeStore((s) => s.dockOrder);
  const hidden = useHomeStore((s) => s.dockHidden);
  return useMemo(
    () => resolveDock(order, hidden).map(spaceOf).filter((s): s is Space => !!s),
    [order, hidden],
  );
}
