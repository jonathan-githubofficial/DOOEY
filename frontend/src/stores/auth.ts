import type { RecordModel } from "pocketbase";
import { create } from "zustand";
import { pb } from "@/lib/pb";

interface AuthStore {
  user: RecordModel | null;
  token: string;
  isAuthenticated: boolean;
  setUser: (user: RecordModel | null, token?: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: pb.authStore.record as RecordModel | null,
  token: pb.authStore.token,
  isAuthenticated: pb.authStore.isValid,
  setUser: (user, token = "") => set({ user, token, isAuthenticated: !!user }),
  clear: () => set({ user: null, token: "", isAuthenticated: false }),
}));

// Keep store in sync with PocketBase auth changes — including the async load
// of a persisted session on boot.
pb.authStore.onChange((token, record) => {
  const { setUser, clear } = useAuthStore.getState();
  if (record) {
    setUser(record as RecordModel, token);
  } else {
    clear();
  }
});
