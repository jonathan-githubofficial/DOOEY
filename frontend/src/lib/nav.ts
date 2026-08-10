import { router, type Href } from "expo-router";

/** Pop, guarding the empty-stack case a bare `router.back()` turns into
 * "the action GO_BACK was not handled by any navigator".
 *
 * Android dispatches the extra GO_BACK for free: a double-tapped chevron, or
 * the hardware back pressed again while the first pop is still animating out.
 * The web starts history at whatever page was reloaded, so a detail page's
 * chevron can have nothing behind it at all. When there is nothing to pop,
 * land on the page's own space instead: in the double-press race that is
 * where the first pop just put you, so it reads as nothing happening, and on
 * a cold entry it is the drill-out the chevron promised. */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
