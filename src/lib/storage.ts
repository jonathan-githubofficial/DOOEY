// The single KV persistence seam (ruling R11). On the Lynx WEB target the app runs in a
// Web Worker with NO window/document/localStorage, so this seam NEVER touches a BOM global.
// It talks to a Lynx NativeModule ("NativeStorageModule": async getItem/setItem/removeItem)
// that the HOST PAGE registers (web-core `nativeModulesMap` + `onNativeModulesCall`), backed
// by main-thread localStorage where it actually exists. Native hosts implement the same
// module later (8.5 runbook). If the module is absent, the seam degrades to an in-memory map
// with a single console.warn (mirrors PocketBase's LocalAuthStore.storageFallback): boot with
// no persistence, never a crash. It backs zustand persistence (theme/style) and, via
// AsyncAuthStore in lib/pb.ts, PocketBase's auth session - so persistence rides this seam and
// never the localStorage global directly.
import type { StateStorage } from "zustand/middleware";

// The module contract the host page exposes on the background-thread global `NativeModules`.
// Calls cross the worker boundary, so every method may resolve asynchronously.
interface NativeStorageModule {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

// web-core injects `NativeModules` as a PARAMETER of the app-bundle function wrapper (verified
// in @lynx-js/web-core 0.22.2: createNativeApp builds `nativeModuleProxy` from the host's
// nativeModulesMap and createChunkLoading passes it into the bundle as the bare `NativeModules`
// binding), NOT as a property of globalThis/self. So the app reads the BARE `NativeModules`
// identifier - `globalThis.NativeModules` is undefined in the worker. @lynx-js/types declares it
// as a background-thread global; the `typeof` guard tolerates a non-Lynx host that never injects
// it. Looked up lazily on each call so a late-registering host or init ordering never matters.
function nativeStorage(): NativeStorageModule | undefined {
  if (typeof NativeModules === "undefined") return undefined;
  return NativeModules.NativeStorageModule as NativeStorageModule | undefined;
}

const memory = new Map<string, string>();
let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  console.warn(
    "[storage] NativeStorageModule unavailable - using in-memory storage (no persistence across reloads).",
  );
}

// getItem/setItem/removeItem return promises; zustand's persist middleware awaits them and
// hydrates asynchronously, and lib/pb.ts's AsyncAuthStore takes the getItem promise as its
// `initial`. The web target reads/writes the host page's localStorage across the seam.
export const appStorage: StateStorage = {
  getItem: async (name) => {
    const native = nativeStorage();
    if (native) return (await native.getItem(name)) ?? null;
    warnOnce();
    return memory.get(name) ?? null;
  },
  setItem: async (name, value) => {
    const native = nativeStorage();
    if (native) {
      await native.setItem(name, value);
      return;
    }
    warnOnce();
    memory.set(name, value);
  },
  removeItem: async (name) => {
    const native = nativeStorage();
    if (native) {
      await native.removeItem(name);
      return;
    }
    warnOnce();
    memory.delete(name);
  },
};
