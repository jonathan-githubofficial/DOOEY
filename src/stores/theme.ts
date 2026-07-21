import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { appStorage } from "@/lib/storage";

export type Theme = "light" | "dark";

interface ThemeStore {
  theme: Theme;
  /** Motion-reduction preference. Gates enter/spring micro-interactions across the app
   * (task-page enter, checklist/resource item enter, the Check tick draw-on). */
  reducedMotion: boolean;
  toggle: () => void;
  set: (t: Theme) => void;
  setReducedMotion: (v: boolean) => void;
  toggleReducedMotion: () => void;
}

/** Light/dark mode as plain reactive state (ruling R11). Unit 3.4 replaced the old L1 seam
 * (activeMode / applyTheme, which stood in for the missing document.documentElement.classList):
 * the theme is now driven purely from this store. The reactive <ThemeVars> root view
 * (src/features/style/ThemeVars.tsx) subscribes to `theme`, emits the resolved CSS-variable
 * palette inline on the app-root <view>, and toggles the `dark` class there so `.dark ...`
 * descendant rules + Tailwind `dark:` variants activate (Lynx theming doc: descendant-selector
 * class toggling + CSS-variable cascade, https://lynxjs.org/api/css/properties/css-variable.html).
 * The web target runs in a Web Worker with no document, so no BOM global is ever touched here.
 *
 * Light is the DEFAULT (CLAUDE.md: "Theme is light + dark only. No system. Light is the
 * default."): initial `theme: "light"`, no system-theme query. Persistence rides the 1.4 storage
 * adapter (async hydration; a pre-hydration flash of the light default is acceptable per SPEC 2). */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      // Motion is ON by default; there is no OS `prefers-reduced-motion` query on the Lynx web
      // worker (R11: no matchMedia), so this is a plain persisted user preference. Unit 4.2 lands
      // the pref + the `useReducedMotion` selector first (L4 land order R4); unit 4.1 wires the
      // Style-studio toggle UI that flips it.
      reducedMotion: false,
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      set: (theme) => set({ theme }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      toggleReducedMotion: () => set({ reducedMotion: !get().reducedMotion }),
    }),
    { name: "dooey-theme", storage: createJSONStorage(() => appStorage) },
  ),
);

/** The reduced-motion preference as a reactive selector (unit 4.2, shared with 4.1/4.3). */
export const useReducedMotion = (): boolean => useThemeStore((s) => s.reducedMotion);
