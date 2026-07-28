import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecordModel } from "pocketbase";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import { newRitual, sanitizeRituals } from "./schedule";
import type { Ritual, RitualKind } from "./types";

interface RitualStore {
  rituals: Ritual[];
  add: (kind: RitualKind, ref?: string, label?: string) => void;
  patch: (id: string, next: Partial<Ritual>) => void;
  remove: (id: string) => void;
}

// Two rituals added inside the same millisecond would otherwise collide, and
// the id is what keys the list and every occurrence expanded from it.
let seq = 0;
const mintId = () => `rt${Date.now().toString(36)}${(seq++).toString(36)}`;

export const useRitualStore = create<RitualStore>()(
  persist(
    (set) => ({
      rituals: [],
      add: (kind, ref = "", label) => {
        set((s) => ({ rituals: [...s.rituals, newRitual(kind, mintId(), ref, label)] }));
        saveRituals();
      },
      patch: (id, next) => {
        set((s) => ({ rituals: s.rituals.map((r) => (r.id === id ? { ...r, ...next } : r)) }));
        saveRituals();
      },
      remove: (id) => {
        set((s) => ({ rituals: s.rituals.filter((r) => r.id !== id) }));
        saveRituals();
      },
    }),
    {
      name: "dooey-rituals",
      storage: createJSONStorage(() => AsyncStorage),
      // The allow-list: a new persisted field must be added here too, or it
      // evaporates on reload (same trap as home/store.ts).
      partialize: ({ rituals }) => ({ rituals }),
      // Same ordering contract as the shell: the local copy is a fast-boot
      // cache so the planner has a schedule to draw before AsyncStorage and
      // the user record resolve, and the record wins whenever it exists.
      merge: (persisted, current) => ({
        ...current,
        rituals: sanitizeRituals((persisted as { rituals?: unknown } | null)?.rituals),
      }),
      onRehydrateStorage: () => () => syncFromUser(useAuthStore.getState().user),
    },
  ),
);

/** Fire-and-forget, like the shell: a failed sync leaves the local copy in
 * place and the next edit retries the whole list. */
function saveRituals() {
  const user = useAuthStore.getState().user;
  if (!user) return;
  pb.collection("users")
    .update(user.id, { rituals: useRitualStore.getState().rituals }, { requestKey: null })
    .catch(() => {});
}

function syncFromUser(user: RecordModel | null) {
  if (!user || user.rituals == null) return;
  useRitualStore.setState({ rituals: sanitizeRituals(user.rituals) });
}

// Hydrate on boot (if already signed in) and whenever the user changes.
syncFromUser(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) syncFromUser(state.user);
});

export function useRituals(): Ritual[] {
  return useRitualStore((s) => s.rituals);
}
