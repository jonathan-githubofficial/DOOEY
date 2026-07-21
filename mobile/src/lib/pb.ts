import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import PocketBase, { AsyncAuthStore } from "pocketbase";

// A device can't reach the dev machine's 127.0.0.1 — but Expo tells us where
// Metro is serving from (the dev machine's LAN address), and PocketBase lives
// on the same box. Deriving the host from there makes phones, emulators and
// the web all find the API with zero config. Production builds set
// EXPO_PUBLIC_PB_URL explicitly.
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
const url =
  process.env.EXPO_PUBLIC_PB_URL ?? (devHost ? `http://${devHost}:8090` : "http://127.0.0.1:8090");

// localStorage doesn't exist in React Native — persist the session through an
// AsyncAuthStore backed by AsyncStorage instead.
const stored = AsyncStorage.getItem("pb_auth");

export const pb = new PocketBase(
  url,
  new AsyncAuthStore({
    save: (serialized) => AsyncStorage.setItem("pb_auth", serialized),
    initial: stored,
    clear: () => AsyncStorage.removeItem("pb_auth"),
  }),
);

/** Resolves once the persisted session (if any) has been loaded into
 * `pb.authStore` — auth state is meaningless before this. */
export const authLoaded = stored.then(async () => {
  // The AsyncAuthStore applies the payload in its own `initial.then(...)`,
  // registered before this one; one extra microtask lets it finish.
  await Promise.resolve();
});
