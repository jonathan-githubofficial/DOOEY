import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Factory values for everything the Style page can change. */
export const BASE = {
  preset: "dooey",
  radius: 24, // card corner radius, px
  grain: 1, // multiplier on the default grain opacity
};

interface StyleStore {
  preset: string;
  radius: number;
  grain: number;
  setPreset: (preset: string) => void;
  setRadius: (radius: number) => void;
  setGrain: (grain: number) => void;
  resetAll: () => void;
}

export const useStyleStore = create<StyleStore>()(
  persist(
    (set) => ({
      ...BASE,
      setPreset: (preset) => set({ preset }),
      setRadius: (radius) => set({ radius }),
      setGrain: (grain) => set({ grain }),
      resetAll: () => set({ ...BASE }),
    }),
    { name: "dooey-style", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The active card corner radius — panels shape themselves through this. */
export function useCardRadius(): number {
  return useStyleStore((s) => s.radius);
}
