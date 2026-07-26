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
  // `pb.authStore.isValid`, never the truthiness of the record. A cleared
  // session persists as `{"token":"","record":{}}`, and `{}` is truthy — so
  // `!!user` reports a signed-in user holding no token. Nothing then fails
  // loudly: the guard lets you through, every list rule filters on
  // `@request.auth.id` and quietly matches nothing, and the app renders itself
  // empty with a 200 on every request. `isValid` checks the token and its
  // expiry, which is the only thing that actually decides this.
  setUser: (user, token = "") => set({ user, token, isAuthenticated: pb.authStore.isValid }),
  clear: () => set({ user: null, token: "", isAuthenticated: false }),
}));

// Keep store in sync with PocketBase auth changes — including the async load
// of a persisted session on boot.
pb.authStore.onChange((token, record) => {
  const { setUser, clear } = useAuthStore.getState();
  if (pb.authStore.isValid && record) {
    setUser(record as RecordModel, token);
  } else {
    clear();
  }
});
