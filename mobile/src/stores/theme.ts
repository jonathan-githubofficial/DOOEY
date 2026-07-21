import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { palettes, type Palette, type ThemeName } from "@/lib/theme";

interface ThemeStore {
  theme: ThemeName;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "dooey-theme", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The active palette — every screen colors itself through this. */
export function usePalette(): Palette {
  return palettes[useThemeStore((s) => s.theme)];
}
