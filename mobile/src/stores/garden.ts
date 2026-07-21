import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Stroke } from "@/lib/doodle";

interface GardenStore {
  /** One little drawing per finished day, keyed YYYY-MM-DD — the garden. */
  signatures: Record<string, Stroke[]>;
  sign: (date: string, strokes: Stroke[]) => void;
}

/** Signing a finished day plants a doodle; the Account page grows them into
 * a garden. Local to this device — it's a diary, not a database. */
export const useGardenStore = create<GardenStore>()(
  persist(
    (set, get) => ({
      signatures: {},
      sign: (date, strokes) => {
        const signatures = { ...get().signatures };
        if (strokes.length) signatures[date] = strokes;
        else delete signatures[date];
        set({ signatures });
      },
    }),
    { name: "dooey-garden", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
