import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type WeightUnit = "lbs" | "kg";
export type Gender = "male" | "female";

/** Gym preferences — display unit, the default rest an exercise starts with,
 * how the rest timer behaves, and the body figure the muscle map draws.
 * Adjusted on the Preferences page, not in the gym itself. */
interface WorkoutPrefs {
  unit: WeightUnit;
  gender: Gender;
  restSeconds: number;
  autoStartRest: boolean;
  restDoneBuzz: boolean;
  seededRoutines: boolean; // one-time starter-routine seed guard
  setUnit: (unit: WeightUnit) => void;
  setGender: (gender: Gender) => void;
  setRestSeconds: (s: number) => void;
  setAutoStartRest: (on: boolean) => void;
  setRestDoneBuzz: (on: boolean) => void;
  markSeeded: () => void;
}

export const useWorkoutPrefs = create<WorkoutPrefs>()(
  persist(
    (set) => ({
      unit: "lbs",
      gender: "male",
      restSeconds: 90,
      autoStartRest: true,
      restDoneBuzz: true,
      seededRoutines: false,
      setUnit: (unit) => set({ unit }),
      setGender: (gender) => set({ gender }),
      setRestSeconds: (restSeconds) => set({ restSeconds: Math.max(15, restSeconds) }),
      setAutoStartRest: (autoStartRest) => set({ autoStartRest }),
      setRestDoneBuzz: (restDoneBuzz) => set({ restDoneBuzz }),
      markSeeded: () => set({ seededRoutines: true }),
    }),
    { name: "dooey-workout-prefs", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Where the live bar sits. Swiping it aside tucks it to that edge as a puck;
 * it stays there until you tap it back open. A per-device view preference, not
 * session data, so it lives here rather than on the workout record. */
interface LiveBarState {
  tucked: "left" | "right" | null;
  tuck: (edge: "left" | "right") => void;
  expand: () => void;
}

export const useLiveBar = create<LiveBarState>()(
  persist(
    (set) => ({
      tucked: null,
      tuck: (edge) => set({ tucked: edge }),
      expand: () => set({ tucked: null }),
    }),
    { name: "dooey-live-bar", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Rest seconds → "m:ss" for the labels and rest clock. */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
