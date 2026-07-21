// A tiny link-open seam (unit 4.2 SPEC 7). Lynx has no `<a>` element, and on the WEB target the
// app runs in a Web Worker with no `window` (ruling R11), so no navigation / URL-open API is
// reachable from app code. Verified during implementation:
//   - `@lynx-js/types` exposes NO `lynx.openSchema` / `openURL` surface (grepped the whole
//     background-thread `Lynx` interface), and
//   - `@lynx-js/web-core` 0.22.2 does not forward any web-host navigation into the worker.
// So on web this is a PARKED gap: links and attachments RENDER, and tapping one is a no-op with a
// single `console.warn` (never a crash). A later pass wires a host-registered "open URL"
// NativeModule (the same R11 pattern the storage seam uses) or `lynx.openSchema` on native hosts
// (8.5). Consumers: Resources (link + YouTube thumbnail) and Attachments (open / download).
export function openExternal(url: string): void {
  console.warn(`[dooey] openExternal: opening links is not wired on the Lynx web target yet (${url})`);
}
