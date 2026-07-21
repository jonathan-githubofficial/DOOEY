import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WeightUnit = "lbs" | "kg";

/** Gym preferences — display unit, the default rest an exercise starts with,
 * and how the rest timer behaves. Adjusted on the Preferences page, not in the
 * gym itself. */
interface WorkoutPrefs {
  unit: WeightUnit;
  restSeconds: number;
  autoStartRest: boolean;
  restDoneBuzz: boolean;
  seededRoutines: boolean; // one-time starter-routine seed guard
  setUnit: (unit: WeightUnit) => void;
  setRestSeconds: (s: number) => void;
  setAutoStartRest: (on: boolean) => void;
  setRestDoneBuzz: (on: boolean) => void;
  markSeeded: () => void;
}

export const useWorkoutPrefs = create<WorkoutPrefs>()(
  persist(
    (set) => ({
      unit: "lbs",
      restSeconds: 90,
      autoStartRest: true,
      restDoneBuzz: true,
      seededRoutines: false,
      setUnit: (unit) => set({ unit }),
      setRestSeconds: (restSeconds) => set({ restSeconds: Math.max(15, restSeconds) }),
      setAutoStartRest: (autoStartRest) => set({ autoStartRest }),
      setRestDoneBuzz: (restDoneBuzz) => set({ restDoneBuzz }),
      markSeeded: () => set({ seededRoutines: true }),
    }),
    { name: "dooey-workout-prefs", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Rest seconds → "m:ss" for the labels and rest clock. */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
