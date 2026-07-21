import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RecordModel } from "pocketbase";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Stroke } from "@/lib/doodle";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores/auth";
import { PRESETS, type ColorKey, type FontKey, type Mode, type PaletteOverrides } from "./tokens";

/** Factory values for everything that isn't a colour — same as the web app. */
export const BASE = {
  fontSans: "outfit" as FontKey,
  fontDisplay: "fraunces" as FontKey,
  radius: 1.5, // rem — px = radius * 16, matching the web's --app-radius-card
  grain: 1, // multiplier on the default grain opacity
  shadow: 1, // multiplier on the default shadow alphas
};

interface StyleStore {
  colors: Record<Mode, PaletteOverrides>;
  fontSans: FontKey;
  fontDisplay: FontKey;
  radius: number;
  grain: number;
  shadow: number;
  /** A soft colour wash breathed over the paper — a BACKDROPS key, or null. */
  backdrop: string | null;
  /** Hand-drawn icons worn next to page titles, keyed by page. */
  pageDoodles: Record<string, Stroke[]>;
  /** Whether the dock island uses those doodles (on) or the stock glyphs (off). */
  dockDoodles: boolean;
  setColor: (mode: Mode, key: ColorKey, triplet: string) => void;
  resetColor: (mode: Mode, key: ColorKey) => void;
  setFont: (slot: "sans" | "display", font: FontKey) => void;
  setShape: (patch: Partial<Pick<StyleStore, "radius" | "grain" | "shadow">>) => void;
  setBackdrop: (key: string | null) => void;
  setPageDoodle: (page: string, strokes: Stroke[]) => void;
  setDockDoodles: (on: boolean) => void;
  applyPreset: (key: string) => void;
  resetAll: () => void;
}

export const useStyleStore = create<StyleStore>()(
  persist(
    (set, get) => ({
      colors: { light: {}, dark: {} },
      ...BASE,
      backdrop: null,
      pageDoodles: {},
      dockDoodles: true,
      setBackdrop: (key) => set({ backdrop: key }),
      setDockDoodles: (on) => set({ dockDoodles: on }),
      setPageDoodle: (page, strokes) => {
        const pageDoodles = { ...get().pageDoodles, [page]: strokes };
        set({ pageDoodles });
        savePageDoodles(pageDoodles);
      },
      setColor: (mode, key, triplet) =>
        set({ colors: { ...get().colors, [mode]: { ...get().colors[mode], [key]: triplet } } }),
      resetColor: (mode, key) => {
        const palette = { ...get().colors[mode] };
        delete palette[key];
        set({ colors: { ...get().colors, [mode]: palette } });
      },
      setFont: (slot, font) => set(slot === "sans" ? { fontSans: font } : { fontDisplay: font }),
      setShape: (patch) => set(patch),
      applyPreset: (key) => {
        const preset = PRESETS.find((p) => p.key === key);
        if (!preset) return;
        set({ colors: { light: { ...preset.colors.light }, dark: { ...preset.colors.dark } } });
      },
      resetAll: () => set({ colors: { light: {}, dark: {} }, ...BASE, backdrop: null }),
    }),
    {
      name: "dooey-style",
      storage: createJSONStorage(() => AsyncStorage),
      // v1: radius went from px (24) to rem (1.5) — stale v0 state would render
      // 384px corners, so anything persisted before versioning is discarded.
      version: 1,
      migrate: () => ({}),
      // pageDoodles are intentionally NOT persisted locally — they live on the
      // user record so they follow the account across devices (and the web app).
      partialize: ({ colors, fontSans, fontDisplay, radius, grain, shadow, backdrop, dockDoodles }) => ({
        colors,
        fontSans,
        fontDisplay,
        radius,
        grain,
        shadow,
        backdrop,
        dockDoodles,
      }),
    },
  ),
);

/** The active card corner radius in px — panels shape themselves through this. */
export function useCardRadius(): number {
  return Math.round(useStyleStore((s) => s.radius) * 16);
}

/** Shadow-strength multiplier — every shadowed surface scales through this. */
export function useShadow(): number {
  return useStyleStore((s) => s.shadow);
}

/** Persist the page-icon doodles onto the signed-in user's record. */
function savePageDoodles(pageDoodles: Record<string, Stroke[]>) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  pb.collection("users")
    .update(user.id, { page_doodles: pageDoodles }, { requestKey: null })
    .then((rec) => useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token))
    .catch(() => {}); // a failed sync just leaves the local copy — retried on next edit
}

/** Pull the page doodles from a freshly-loaded user record into the store. */
function syncPageDoodlesFromUser(user: RecordModel | null) {
  if (!user) return;
  const server = (user.page_doodles as Record<string, Stroke[]> | null) ?? {};
  if (Object.keys(server).length > 0) useStyleStore.setState({ pageDoodles: server });
}

// Hydrate on boot (if already signed in) and whenever the user changes.
syncPageDoodlesFromUser(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) syncPageDoodlesFromUser(state.user);
});
