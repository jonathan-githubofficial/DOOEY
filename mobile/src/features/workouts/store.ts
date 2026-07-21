import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WeightUnit = "lbs" | "kg";

/** Gym preferences — display unit and the rest countdown between sets. */
interface WorkoutPrefs {
  unit: WeightUnit;
  restSeconds: number;
  setUnit: (unit: WeightUnit) => void;
  setRestSeconds: (s: number) => void;
}

export const useWorkoutPrefs = create<WorkoutPrefs>()(
  persist(
    (set) => ({
      unit: "lbs",
      restSeconds: 90,
      setUnit: (unit) => set({ unit }),
      setRestSeconds: (restSeconds) => set({ restSeconds: Math.max(15, restSeconds) }),
    }),
    { name: "dooey-workout-prefs", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
