import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import type { TextStyle, ViewStyle } from "react-native";
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

/** The factory light palette, resolved once and theme-independent. The front
 * door (login and the gutters around it) is always a lit gallery wall — it
 * must not inherit a dark theme left over from a previous session. */
export const LIGHT_PALETTE: Palette = (() => {
  const out = {} as Palette;
  for (const { key } of COLOR_TOKENS) out[KEY_MAP[key]] = tripletToHsl(DEFAULT_COLORS.light[key]);
  return out;
})();

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

/** A complete shadow style, scaled by the user's shadow slider and tinted from
 * their own ink. Two levels and no more:
 *
 * - `rest`: a card sitting on the page. Nearly everything.
 * - `lifted`: an object the finger is holding. A drag, a reorder, the live block.
 *
 * The tint is the point. A hardcoded `shadowColor` stays warm brown when the
 * user picks a cool palette, which leaves a corner of the app they cannot
 * reach. Deriving it from `ink` means their theme goes all the way down. */
export function useElevation(level: "rest" | "lifted" = "rest"): ViewStyle {
  const shadow = useStyleStore((s) => s.shadow);
  const { ink } = usePalette();
  const lifted = level === "lifted";
  return useMemo(
    () => ({
      shadowColor: ink,
      shadowOpacity: (lifted ? 0.22 : 0.08) * shadow,
      shadowRadius: lifted ? 18 : 8,
      shadowOffset: { width: 0, height: lifted ? 6 : 3 },
      elevation: Math.round((lifted ? 8 : 2) * shadow),
    }),
    [ink, shadow, lifted],
  );
}
