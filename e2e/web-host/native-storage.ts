// Host-side registration of the R11 NativeStorageModule for the Lynx WEB target.
//
// The app runs in a Web Worker with no localStorage; this registers a Lynx NativeModule the
// worker can call, backed by the HOST PAGE's (main-thread) localStorage where it exists. Every
// web host page (this e2e host, the boot-probe host, and 8.1's prod pb_public host) registers
// the same module; native hosts implement the same interface later (8.5 runbook).
//
// web-core@0.22.2 mechanism (verified from node_modules/@lynx-js/web-core source +
// https://lynxjs.org/guide/use-native-modules):
//   - `lynx-view.nativeModulesMap` : { moduleName: <esm url> }. The background worker
//     dynamic-imports that ESM (module worker, so `import()` of a same-origin blob URL works)
//     and calls its default export `(nativeModules, call) => moduleImpl`. `moduleImpl` becomes
//     the background-thread global `NativeModules[moduleName]` the app reads, and `call(name,
//     data)` RPCs to the main thread. (createNativeModules.js)
//   - `lynx-view.onNativeModulesCall` : (name, data, moduleName) => value | Promise, invoked
//     on the MAIN thread (localStorage lives here) for every `call(name, data)` the worker
//     makes; its return value is transported back to the worker. (registerNativeModulesCallHandler.js)

// The proxy ESM that runs in the WORKER: forwards each method to the main-thread handler.
// Kept as source text and turned into a blob URL so no separate static asset must be served -
// the same helper works for every host page unchanged.
const PROXY_SOURCE = `export default function (nativeModules, call) {
  return {
    getItem: (key) => call('getItem', key),
    setItem: (key, value) => call('setItem', [key, value]),
    removeItem: (key) => call('removeItem', key),
  };
}`;

/** The subset of the web-core <lynx-view> element this helper configures. */
export interface LynxViewLike extends HTMLElement {
  nativeModulesMap?: Record<string, string>;
  onNativeModulesCall?: (name: string, data: unknown, moduleName: string) => unknown;
}

/** Register NativeStorageModule on a <lynx-view> BEFORE it is connected/loaded. The main-thread
 * handler reads/writes this page's localStorage - which is exactly the storage seam the E2E
 * suite seeds (key "pb_auth") to drive a programmatic sign-in. */
export function registerNativeStorage(view: LynxViewLike): void {
  const proxyUrl = URL.createObjectURL(new Blob([PROXY_SOURCE], { type: "text/javascript" }));
  view.nativeModulesMap = { ...view.nativeModulesMap, NativeStorageModule: proxyUrl };
  view.onNativeModulesCall = (name, data, moduleName) => {
    if (moduleName !== "NativeStorageModule") return;
    switch (name) {
      case "getItem":
        return localStorage.getItem(data as string);
      case "setItem": {
        const [key, value] = data as [string, string];
        localStorage.setItem(key, value);
        return;
      }
      case "removeItem":
        localStorage.removeItem(data as string);
        return;
    }
  };
}
