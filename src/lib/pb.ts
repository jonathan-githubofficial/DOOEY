// PocketBase client seam (unit 1.4, ruling R11). Host resolution, the realtime EventSource
// wiring for web vs native, and a storage-adapter-backed AsyncAuthStore so auth persistence
// rides the KV seam instead of a BOM global. The web target runs in a Web Worker with NO
// window/document/localStorage, so this module never touches those globals. Exported shape is
// unchanged from 1.3 (`pb`); every store and api.ts imports it.
import PocketBase, { AsyncAuthStore } from "pocketbase";
import { appStorage } from "@/lib/storage";

// SPEC 1 (R11) - host/origin resolution. `import.meta.env.PUBLIC_PB_URL` (rsbuild PUBLIC_
// prefix) is the BUILD-TIME override (native builds + e2e). At runtime the HOST PAGE passes
// the PB origin into the app via Lynx globalProps (`lynx.__globalProps.pbUrl`); 8.1's prod
// host passes same-origin. Dev falls back to the local PocketBase. App code NEVER reads
// window.location (R11: no BOM in the web worker; native has no window either).
const globalProps = (globalThis as { lynx?: { __globalProps?: { pbUrl?: string } } }).lynx
  ?.__globalProps;
const host =
  import.meta.env.PUBLIC_PB_URL ||
  globalProps?.pbUrl ||
  (import.meta.env.DEV ? "http://127.0.0.1:8090" : "");

// SPEC 2 - fetch. The pocketbase SDK calls the global fetch. On web that is the worker's fetch
// (used automatically, no injection). On native Lynx provides its own global fetch; standard
// streaming (enableFetchAPIStandardStreaming) is experimental and PARKED (native-only).

// SPEC 3 - realtime (SSE). The SDK's RealtimeService instantiates `new EventSource(...)`
// against the global and exposes no injection hook. On the WEB worker the platform EventSource
// is present (this is what the 1.5 SSE proof exercises), so nothing is touched. On NATIVE
// there is no global EventSource: wire Lynx's (lynx.EventSource, "same API as web" - PLAN 5.4)
// by assigning the global when the platform one is absent. Decoding SSE payloads on native
// additionally needs a PrimJS TextDecoder/TextCodecHelper shim - PARKED (native-only; the web
// target uses the platform TextDecoder). useCollectionLive rides whichever EventSource is active.
const g = globalThis as { EventSource?: unknown; lynx?: { EventSource?: unknown } };
if (!g.EventSource && g.lynx?.EventSource) {
  g.EventSource = g.lynx.EventSource;
}

// SPEC 4 (R11, HIGH-RISK: session semantics) - storage-backed authStore. AsyncAuthStore
// persists the serialized auth state through the appStorage KV seam. The seam is ASYNC (its
// getItem crosses the worker boundary to the host's localStorage), so hydration is async:
// `initial` is a promise the store awaits, then fires authStore.onChange (stores/auth.ts) to
// surface a returning session. Boot tolerates late hydration - initSession (features/auth/api.ts)
// no-ops while the token is not yet hydrated (isValid false) and never wrongly drops a session;
// its definitive-4xx-only drop rule is unchanged.
const authStore = new AsyncAuthStore({
  save: async (serialized) => {
    await appStorage.setItem("pb_auth", serialized);
  },
  initial: Promise.resolve(appStorage.getItem("pb_auth")).then((v) => v ?? undefined),
  clear: async () => {
    await appStorage.removeItem("pb_auth");
  },
});

export const pb = new PocketBase(host, authStore);
