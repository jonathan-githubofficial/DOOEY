import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import PocketBase, { AsyncAuthStore } from "pocketbase";

/** PocketBase's port, everywhere except production web (where it is whatever
 * port served the page). */
const PB_PORT = 8090;

const web = Platform.OS === "web" && typeof window !== "undefined";
// A device can't reach the dev machine's 127.0.0.1, but Expo tells us where
// Metro is serving from — the dev machine's LAN address — and PocketBase lives
// on the same box. There is no hostUri on the web, in dev or otherwise.
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];

/** Where the API is. Four cases, and getting the order wrong is silent: a
 * request to the wrong origin comes back as Metro's `index.html` with a 200 on
 * it, so the SDK sees HTML, parses nothing, and the app just looks empty.
 *
 * 1. `EXPO_PUBLIC_PB_URL` wins outright — that is how a production native build
 *    is told where its server lives. `||` rather than `??` because an unset
 *    `EXPO_PUBLIC_*` inlines as an empty string, not as undefined.
 * 2. **Production web**: PocketBase served this page, so it is its own origin.
 * 3. **Dev web**: Metro served the page on :8081 and PocketBase sits beside it
 *    on :8090. Taking the host from the URL rather than hardcoding localhost
 *    means the web build also works from a phone on the LAN.
 * 4. **Dev native**: Metro's host, same port. */
const url =
  process.env.EXPO_PUBLIC_PB_URL ||
  (web
    ? __DEV__
      ? `${window.location.protocol}//${window.location.hostname}:${PB_PORT}`
      : window.location.origin
    : devHost
      ? `http://${devHost}:${PB_PORT}`
      : `http://127.0.0.1:${PB_PORT}`);

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
