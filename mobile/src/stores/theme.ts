import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStyleStore } from "@/features/style/store";
import { PRESETS } from "@/features/style/tokens";
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

// One resolved palette per (theme, preset) — cached so selectors stay
// referentially stable and consumers don't re-render on unrelated changes.
const resolved = new Map<string, Palette>();

function resolvePalette(theme: ThemeName, presetKey: string): Palette {
  const cacheKey = `${theme}/${presetKey}`;
  const hit = resolved.get(cacheKey);
  if (hit) return hit;
  const preset = PRESETS.find((p) => p.key === presetKey);
  const merged = { ...palettes[theme], ...preset?.colors[theme] };
  resolved.set(cacheKey, merged);
  return merged;
}

/** The active palette (factory tokens + the chosen preset's overrides) —
 * every screen colors itself through this. */
export function usePalette(): Palette {
  const theme = useThemeStore((s) => s.theme);
  const preset = useStyleStore((s) => s.preset);
  return resolvePalette(theme, preset);
}
