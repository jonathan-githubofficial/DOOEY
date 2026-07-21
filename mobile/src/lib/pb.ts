import AsyncStorage from "@react-native-async-storage/async-storage";
import PocketBase, { AsyncAuthStore } from "pocketbase";
import { Platform } from "react-native";

// A device (or emulator) can't reach the dev machine's 127.0.0.1, so the URL
// must be explicit for real hardware: set EXPO_PUBLIC_PB_URL to the LAN or
// production host. The fallbacks cover emulators talking to a local
// `pb/pocketbase.exe serve` — Android's emulator maps the host to 10.0.2.2.
const url =
  process.env.EXPO_PUBLIC_PB_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:8090" : "http://127.0.0.1:8090");

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
