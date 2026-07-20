import PocketBase from "pocketbase";

// Resolution order: explicit VITE_PB_URL (required for native mobile builds —
// a device can't reach the serving origin's localhost), then the dev server's
// local PocketBase, then same-origin — the Docker image has PocketBase serve
// the built app itself, so in production the API is wherever the app came from.
export const pb = new PocketBase(
  import.meta.env.VITE_PB_URL ||
    (import.meta.env.DEV ? "http://127.0.0.1:8090" : window.location.origin),
);
