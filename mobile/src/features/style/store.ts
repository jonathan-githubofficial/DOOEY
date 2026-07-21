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
  /** Your own photo under the paper (a copied-local uri), softened to blend. */
  backdropImage: string | null;
  backdropBlur: number; // px of blur over the photo
  backdropOpacity: number; // 0..1 — how much of it shows through the paper
  /** Paper sounds: page flips and pencil scratches. Off by default. */
  sounds: boolean;
  /** The margin companion's poses — a flipbook of doodled frames. */
  companion: Stroke[][];
  /** The wordmark's doodled animation frames — drawn on and around the
   * wordmark itself, played over it on the login page. Persisted locally on
   * purpose: login renders before any session exists. */
  logoDoodle: Stroke[][];
  /** How fast the wordmark animation flips, in ms per frame. */
  logoInterval: number;
  /** Hand-drawn icons worn next to page titles, keyed by page. */
  pageDoodles: Record<string, Stroke[]>;
  /** Whether the dock island uses those doodles (on) or the stock glyphs (off). */
  dockDoodles: boolean;
  setColor: (mode: Mode, key: ColorKey, triplet: string) => void;
  resetColor: (mode: Mode, key: ColorKey) => void;
  setFont: (slot: "sans" | "display", font: FontKey) => void;
  setShape: (patch: Partial<Pick<StyleStore, "radius" | "grain" | "shadow">>) => void;
  setBackdrop: (key: string | null) => void;
  setBackdropImage: (uri: string | null) => void;
  setBackdropEffect: (patch: Partial<Pick<StyleStore, "backdropBlur" | "backdropOpacity">>) => void;
  setSounds: (on: boolean) => void;
  setCompanion: (frames: Stroke[][]) => void;
  setLogoDoodle: (frames: Stroke[][]) => void;
  setLogoInterval: (ms: number) => void;
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
      backdropImage: null,
      backdropBlur: 12,
      backdropOpacity: 0.2,
      sounds: false,
      companion: [],
      logoDoodle: [],
      logoInterval: 550,
      pageDoodles: {},
      dockDoodles: true,
      setCompanion: (frames) => {
        const companion = frames.filter((f) => f.length > 0);
        set({ companion });
        saveCompanion(companion);
      },
      setLogoDoodle: (frames) => {
        const logoDoodle = frames.filter((f) => f.length > 0);
        set({ logoDoodle });
        saveLogo(logoDoodle, get().logoInterval);
      },
      setLogoInterval: (logoInterval) => {
        set({ logoInterval });
        saveLogo(get().logoDoodle, logoInterval);
      },
      setBackdrop: (key) => set({ backdrop: key }),
      setBackdropImage: (uri) => set({ backdropImage: uri }),
      setBackdropEffect: (patch) => set(patch),
      setSounds: (on) => set({ sounds: on }),
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
      resetAll: () =>
        set({
          colors: { light: {}, dark: {} },
          ...BASE,
          backdrop: null,
          backdropImage: null,
          backdropBlur: 12,
          backdropOpacity: 0.2,
        }),
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
      partialize: ({
        colors,
        fontSans,
        fontDisplay,
        radius,
        grain,
        shadow,
        backdrop,
        backdropImage,
        backdropBlur,
        backdropOpacity,
        sounds,
        companion,
        logoDoodle,
        logoInterval,
        dockDoodles,
      }) => ({
        colors,
        fontSans,
        fontDisplay,
        radius,
        grain,
        shadow,
        backdrop,
        backdropImage,
        backdropBlur,
        backdropOpacity,
        sounds,
        companion,
        logoDoodle,
        logoInterval,
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

/** Persist the companion frames onto the signed-in user's record, so the
 * little creature follows the account to every device (phone + web). */
function saveCompanion(companion: Stroke[][]) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  pb.collection("users")
    .update(user.id, { companion }, { requestKey: null })
    .then((rec) => useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token))
    .catch(() => {}); // a failed sync just leaves the local copy — retried on next edit
}

/** Persist the wordmark animation onto the user record — same deal as the
 * companion, so the front door greets you on every device. */
function saveLogo(frames: Stroke[][], interval: number) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  pb.collection("users")
    .update(user.id, { logo_doodle: { frames, interval } }, { requestKey: null })
    .then((rec) => useAuthStore.getState().setUser(rec as RecordModel, pb.authStore.token))
    .catch(() => {}); // a failed sync just leaves the local copy — retried on next edit
}

/** Pull the page doodles + companion from a freshly-loaded user record. */
function syncFromUser(user: RecordModel | null) {
  if (!user) return;
  const doodles = (user.page_doodles as Record<string, Stroke[]> | null) ?? {};
  if (Object.keys(doodles).length > 0) useStyleStore.setState({ pageDoodles: doodles });
  const companion = (user.companion as Stroke[][] | null) ?? [];
  if (companion.length > 0) useStyleStore.setState({ companion });
  const logo = user.logo_doodle as { frames?: Stroke[][]; interval?: number } | null;
  if (logo?.frames?.length) {
    useStyleStore.setState({ logoDoodle: logo.frames, logoInterval: logo.interval ?? 550 });
  }
}

// Hydrate on boot (if already signed in) and whenever the user changes.
syncFromUser(useAuthStore.getState().user);
useAuthStore.subscribe((state, prev) => {
  if (state.user !== prev.user) syncFromUser(state.user);
});
