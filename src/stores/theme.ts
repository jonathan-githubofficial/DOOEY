import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { appStorage } from "@/lib/storage";

export type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

/** Resolved light/dark mode as a plain module value (ruling R11). The web target runs in a
 * Web Worker with no document, so there is no `.dark` class on an <html> element to read; the
 * style layer reads the mode from here (features/style/store.ts applyStyle) to pick the
 * palette. Unit 3.4 replaces this with a reactive root-view CSS-variable cascade. */
export let activeMode: Theme = "light";

/** R11 thread-safe seam: record the active mode without touching the BOM (no document in the
 * web worker). Unit 3.4 replaces the imperative apply with the reactive root-view mechanism. */
export function applyTheme(theme: Theme) {
  activeMode = theme;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggle: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        applyTheme(next);
        set({ theme: next });
      },
      set: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    { name: "dooey-theme", storage: createJSONStorage(() => appStorage) },
  ),
);
