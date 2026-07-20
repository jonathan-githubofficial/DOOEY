// Browser host page for the E2E oracle. The Lynx web build emits `dist/main.web.bundle`
// (a web-decodable template), NOT a standalone HTML page - it must be mounted inside a
// `<lynx-view>` provided by the @lynx-js/web-core / web-elements runtime (Phase 0 spike
// finding R6). This tiny entry registers that runtime and mounts the built bundle so
// Playwright has a real page to drive. rsbuild bundles the web-core runtime here; the
// bundle itself is served untouched from `dist/` via the config's publicDir.
//
// R11: the app runs in a Web Worker with no localStorage, so this host page registers the
// NativeStorageModule (backed by main-thread localStorage) and passes the disposable PB origin
// via Lynx globalProps. Seeding localStorage["pb_auth"] from Playwright therefore drives the
// app's AsyncAuthStore through the storage seam.
import "@lynx-js/web-elements/index.css";
import "@lynx-js/web-core/client";

import { registerNativeStorage, type LynxViewLike } from "./native-storage";

// The disposable PB origin. PUBLIC_PB_URL (build-time) is the app's primary source; globalProps
// is the R11 runtime mechanism (8.1's prod host passes same-origin the same way).
const PB_URL = "http://127.0.0.1:8091";

const view = document.createElement("lynx-view") as LynxViewLike;
// Configure all inputs BEFORE the element is connected (connectedCallback boots the worker).
registerNativeStorage(view);
(view as LynxViewLike & { globalProps?: unknown }).globalProps = { pbUrl: PB_URL };
view.setAttribute("url", "/main.web.bundle");
view.style.cssText = "display:block;width:100vw;height:100vh";
document.body.append(view);
