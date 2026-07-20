/** Safe-area handling for edge-hugging UI (the bottom dock, full-bleed headers).
 *
 * WEB TARGET (verified by this run): Lynx's web output renders through a real browser
 * (@lynx-js/web-core), so the standard CSS `env(safe-area-inset-*)` function - already
 * used by the old app (index.html's `viewport-fit=cover` + Tailwind arbitrary values like
 * `pb-[calc(8rem+env(safe-area-inset-bottom))]`) - continues to work unchanged there. Keep
 * using it verbatim in Tailwind arbitrary-value classes on web-rendered edge UI.
 *
 * NATIVE TARGETS (iOS/Android/HarmonyOS via Sparkling, out of reach on this machine): as of
 * this writing there is no documented, stable Lynx CSS or JS safe-area-inset API - see the
 * open upstream issue https://github.com/lynx-family/lynx/issues/299 ("How to get safe area
 * insets... on iOS?"). `env()` does not resolve outside a browser context, so native hosts
 * need a real native-module bridge that does not exist yet. Unit 8.5 (native hosts, PARKED
 * in this run) must re-check that issue and lynxjs.org's native-modules docs
 * (https://lynxjs.org/guide/use-native-modules) before shipping edge-hugging native UI -
 * do not guess a value; hardcoding a platform-typical inset (e.g. 34px for an iPhone home
 * indicator) would silently break on other devices.
 */
export const SAFE_AREA_NOTE = "web: env(safe-area-inset-*) via CSS; native: unresolved, see lynx-family/lynx#299";
