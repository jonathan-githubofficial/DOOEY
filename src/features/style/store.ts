import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pb";
import { appStorage } from "@/lib/storage";
import type { Stroke } from "@/lib/doodle";
import { activeMode, useAuthStore, useThemeStore } from "@/stores";
import {
  deleteStoredBackdrop,
  loadStoredBackdrop,
  processBackdropFile,
  storeBackdrop,
} from "./backdrop";
import {
  COLOR_TOKENS,
  FONT_STACKS,
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
        applyStyle();
      },
      resetColor: (mode, key) => {
        const palette = { ...get().colors[mode] };
        delete palette[key];
        set({ colors: { ...get().colors, [mode]: palette } });
        applyStyle();
      },
      setFont: (slot, font) => {
        set(slot === "sans" ? { fontSans: font } : { fontDisplay: font });
        applyStyle();
      },
      setShape: (patch) => {
        set(patch);
        applyStyle();
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
        applyStyle();
      },
      resetAll: () => {
        set({ colors: { light: {}, dark: {} }, ...BASE });
        applyStyle();
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

const stackOf = (key: FontKey) => FONT_STACKS.find((f) => f.key === key)!.stack;

/** Computed CSS variables for the active mode (ruling R11). In L1 this is the thread-safe seam
 * the app holds in memory - the web target runs in a Web Worker with no document. Unit 3.4
 * binds it onto the root <view> so the variables cascade to descendants (the reactive
 * CSS-variable seam that replaces the old document.documentElement writes). */
export const styleVars: Record<string, string> = {};

/** Recompute styleVars from the store for the active light/dark mode. Values still at factory
 * default are omitted so the design tokens in global.css stay in charge. Never touches the BOM
 * (R11): the mode comes from theme state (activeMode), not a document class, and the vars land
 * in styleVars, not on document.documentElement. */
export function applyStyle() {
  const s = useStyleStore.getState();
  const mode: Mode = activeMode;
  const put = (prop: string, value: string | null) => {
    if (value === null) delete styleVars[prop];
    else styleVars[prop] = value;
  };

  for (const { key } of COLOR_TOKENS) put(`--${key}`, s.colors[mode][key] ?? null);
  put("--app-font-sans", s.fontSans === BASE.fontSans ? null : stackOf(s.fontSans));
  put("--app-font-display", s.fontDisplay === BASE.fontDisplay ? null : stackOf(s.fontDisplay));
  put("--app-radius-card", s.radius === BASE.radius ? null : `${s.radius}rem`);
  put("--grain-strength", s.grain === BASE.grain ? null : String(s.grain));
  put("--shadow-strength", s.shadow === BASE.shadow ? null : String(s.shadow));
}

// Re-apply the active mode's palette whenever light/dark flips.
useThemeStore.subscribe(applyStyle);
