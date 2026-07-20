// Storage seam. Web impl now; unit 1.4 formalizes this (web + native-PARKED) and
// reuses appStorage to back pb.authStore. This is the single KV persistence seam.
import type { StateStorage } from "zustand/middleware";

export const appStorage: StateStorage = {
  getItem: (name) => localStorage.getItem(name),
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
};
