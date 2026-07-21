import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { appStorage } from "@/lib/storage";
import type { Stroke } from "@/lib/doodle";
import { useAuthStore } from "@/stores";
import {
  deleteStoredBackdrop,
  loadStoredBackdrop,
  processBackdropFile,
  storeBackdrop,
} from "./backdrop";
import {
  PRESETS,
  type ColorKey,
  type FontKey,
  type Mode,
  type Palette,
} from "./tokens";

/** Factory values for everything that isn't a colour. */
export const BASE = {
  fontSans: "outfit" as FontKey,
  fontDisplay: "fraunces" as FontKey,
  radius: 1.5, // rem
  grain: 1, // multiplier on the default grain opacity
  shadow: 1, // multiplier on the default shadow alphas
};

export type Device = "mobile" | "desktop";

export interface BackdropCrop {
  x: number; // object-position, 0–100
  y: number;
  zoom: number;
}

export interface BackdropSettings {
  blur: number; // px
  opacity: number; // 0–1
  mobile: BackdropCrop;
  desktop: BackdropCrop;
}

export const BASE_CROP: BackdropCrop = { x: 50, y: 50, zoom: 1 };
export const BASE_BACKDROP: BackdropSettings = {
  blur: 6,
  opacity: 0.25,
  mobile: BASE_CROP,
  desktop: BASE_CROP,
};

/** Tasteful ceilings: the backdrop stays an undertone behind the paper, never
 * a poster the UI has to fight for contrast. */
export const BACKDROP_LIMITS = {
  blur: { min: 0, max: 24 },
  opacity: { min: 0.05, max: 0.5 },
  zoom: { min: 1, max: 2.5 },
};

interface StyleStore {
  colors: Record<Mode, Palette>;
  fontSans: FontKey;
  fontDisplay: FontKey;
  radius: number;
  grain: number;
  shadow: number;
  backdrop: BackdropSettings;
  /** Object URL of the stored photo — runtime only, never persisted. */
  backdropUrl: string | null;
  /** Hand-drawn icons worn next to page titles, keyed by page. */
  pageDoodles: Record<string, Stroke[]>;
  /** Whether the dock island uses those doodles (on) or the stock glyphs (off). */
  dockDoodles: boolean;
  setColor: (mode: Mode, key: ColorKey, triplet: string) => void;
  resetColor: (mode: Mode, key: ColorKey) => void;
  setFont: (slot: "sans" | "display", font: FontKey) => void;
  setShape: (patch: Partial<Pick<StyleStore, "radius" | "grain" | "shadow">>) => void;
  setPageDoodle: (page: string, strokes: Stroke[]) => void;
  setDockDoodles: (on: boolean) => void;
  setBackdrop: (patch: Partial<Pick<BackdropSettings, "blur" | "opacity">>) => void;
  setBackdropCrop: (device: Device, patch: Partial<BackdropCrop>) => void;
  setBackdropImage: (file: File) => Promise<void>;
  removeBackdropImage: () => Promise<void>;
  applyPreset: (key: string) => void;
  resetAll: () => void;
}

export const useStyleStore = create<StyleStore>()(
  persist(
    (set, get) => ({
      colors: { light: {}, dark: {} },
      ...BASE,
      backdrop: BASE_BACKDROP,
      backdropUrl: null,
      pageDoodles: {},
      dockDoodles: true,
      setDockDoodles: (on) => set({ dockDoodles: on }),
      setPageDoodle: (page, strokes) => {
        const pageDoodles = { ...get().pageDoodles, [page]: strokes };
        set({ pageDoodles });
        savePageDoodles(pageDoodles);
      },
      setColor: (mode, key, triplet) => {
        set({ colors: { ...get().colors, [mode]: { ...get().colors[mode], [key]: triplet } } });
      },
      resetColor: (mode, key) => {
        const palette = { ...get().colors[mode] };
        delete palette[key];
        set({ colors: { ...get().colors, [mode]: palette } });
      },
      setFont: (slot, font) => {
        set(slot === "sans" ? { fontSans: font } : { fontDisplay: font });
      },
      setShape: (patch) => {
        set(patch);
      },
      setBackdrop: (patch) => set({ backdrop: { ...get().backdrop, ...patch } }),
      setBackdropCrop: (device, patch) =>
        set({
          backdrop: {
            ...get().backdrop,
            [device]: { ...get().backdrop[device], ...patch },
          },
        }),
      setBackdropImage: async (file) => {
        const blob = await processBackdropFile(file);
        await storeBackdrop(blob);
        const previous = get().backdropUrl;
        set({ backdropUrl: URL.createObjectURL(blob) });
        if (previous) URL.revokeObjectURL(previous);
      },
      removeBackdropImage: async () => {
        await deleteStoredBackdrop();
        const previous = get().backdropUrl;
        set({ backdropUrl: null, backdrop: BASE_BACKDROP });
        if (previous) URL.revokeObjectURL(previous);
      },
      applyPreset: (key) => {
        const preset = PRESETS.find((p) => p.key === key);
        if (!preset) return;
        set({ colors: { light: { ...preset.colors.light }, dark: { ...preset.colors.dark } } });
      },
      resetAll: () => {
        set({ colors: { light: {}, dark: {} }, ...BASE });
        void get().removeBackdropImage();
      },
    }),
    {
      name: "dooey-style",
      storage: createJSONStorage(() => appStorage),
      // pageDoodles are intentionally NOT persisted locally — they live on the
      // user record (savePageDoodles / syncPageDoodlesFromUser) so they follow
      // the account across browsers, like the profile avatar.
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

/** Persist the page-icon doodles onto the signed-in user's record. */
function savePageDoodles(pageDoodles: Record<string, Stroke[]>) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  pb.collection("users")
    .update(user.id, { page_doodles: pageDoodles }, { requestKey: null })
    .then((rec) => useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token))
    .catch(() => {}); // a failed sync just leaves the local copy — retried on next edit
}

/** Pull the page doodles from a freshly-loaded user record into the store. If
 * the account has none yet but this browser drew some, push those up (one-time
 * migration from the old localStorage-only behaviour). */
function syncPageDoodlesFromUser(user: RecordModel | null) {
  if (!user) return;
  const server = (user.page_doodles as Record<string, Stroke[]> | null) ?? {};
  if (Object.keys(server).length > 0) {
    useStyleStore.setState({ pageDoodles: server });
  } else {
    const local = useStyleStore.getState().pageDoodles;
    if (Object.keys(local).length > 0) savePageDoodles(local);
  }
}

// Hydrate on boot (if already signed in) and whenever the user changes.
syncPageDoodlesFromUser(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) syncPageDoodlesFromUser(state.user);
});

/** Rehydrate the stored photo (if any) into an object URL at boot. */
export async function loadBackdrop() {
  const blob = await loadStoredBackdrop();
  if (blob) useStyleStore.setState({ backdropUrl: URL.createObjectURL(blob) });
}

// The old imperative applyStyle() (which wrote the resolved palette to a module object, itself a
// stand-in for the src-legacy document.documentElement writes) is GONE (unit 3.4). Style is now
// applied REACTIVELY: <ThemeVars> (src/features/style/ThemeVars.tsx) subscribes to this store +
// useThemeStore and renders the full CSS-variable palette inline on the app-root <view>, so every
// setter above just updates state and the root view re-renders. See ThemeVars for the mechanism.
