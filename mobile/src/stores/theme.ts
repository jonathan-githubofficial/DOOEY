import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import type { TextStyle } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useStyleStore } from "@/features/style/store";
import {
  COLOR_TOKENS,
  DEFAULT_COLORS,
  fontStyle,
  tripletToHsl,
  type ColorKey,
} from "@/features/style/tokens";
import type { Palette } from "@/lib/theme";

export type ThemeName = "light" | "dark";

interface ThemeStore {
  theme: ThemeName;
  toggle: () => void;
  set: (t: ThemeName) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      set: (theme) => set({ theme }),
    }),
    { name: "dooey-theme", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

const KEY_MAP: Record<ColorKey, keyof Palette> = {
  paper: "paper",
  surface: "surface",
  ink: "ink",
  "ink-muted": "inkMuted",
  rule: "rule",
  zest: "zest",
  leaf: "leaf",
  sky: "sky",
  clay: "clay",
  honey: "honey",
};

/** The active palette: factory tokens + the Style studio's per-mode overrides
 * — every screen colors itself through this. */
export function usePalette(): Palette {
  const mode = useThemeStore((s) => s.theme);
  const overrides = useStyleStore((s) => s.colors[mode]);
  return useMemo(() => {
    const out = {} as Palette;
    for (const { key } of COLOR_TOKENS) {
      out[KEY_MAP[key]] = tripletToHsl(overrides[key] ?? DEFAULT_COLORS[mode][key]);
    }
    return out;
  }, [mode, overrides]);
}

export interface Type {
  sans: TextStyle;
  sansMedium: TextStyle;
  sansSemiBold: TextStyle;
  display: TextStyle;
  displayBlack: TextStyle;
}

/** The active typography, resolved from the Style studio's font choices.
 * Text styles compose these fragments instead of naming families directly. */
export function useType(): Type {
  const sans = useStyleStore((s) => s.fontSans);
  const display = useStyleStore((s) => s.fontDisplay);
  return useMemo(
    () => ({
      sans: fontStyle(sans, "400"),
      sansMedium: fontStyle(sans, "500"),
      sansSemiBold: fontStyle(sans, "600"),
      display: fontStyle(display, "700"),
      displayBlack: fontStyle(display, "900"),
    }),
    [sans, display],
  );
}
