import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** On the web the app sits in a tablet-width frame instead of stretching
 * wall-to-wall. Anything that hangs OUTSIDE the navigator (the live bar) has
 * to line itself up with the same frame, or it drifts to the left gutter. */
export const FRAME_W = 840;

/** How tall the bottom chrome is. The web build draws DOOEY's own island; on
 * native the platform draws the bar, and its height is a platform constant
 * rather than something the root layout can measure from outside the tabs. */
const WEB_DOCK = 50;
const IOS_TABS = 49;
const ANDROID_TABS = 80;

/** The gap a floating control keeps above the dock. One number, so the
 * add-task stamp and the live bar ride at the same height everywhere. */
export const DOCK_GAP = 14;

/** The dock's top edge, measured up from the bottom of the window — what
 * every floating control anchors to. `docked` is false on the routes that
 * draw no dock at all; there it's just the home indicator to clear. */
export function useDockTop(docked = true): number {
  const insets = useSafeAreaInsets();
  if (!docked) return Math.max(insets.bottom, 12);
  return Platform.select({
    web: Math.max(16, insets.bottom) + WEB_DOCK,
    ios: insets.bottom + IOS_TABS,
    default: ANDROID_TABS,
  });
}

/** A page's own breathing room above the safe area. */
const PAGE_TOP = 12;
/** What a scroller leaves under its last row so the dock never covers it. */
const PAGE_BOTTOM = 96;
/** Floor for the bottom inset on hardware with no home indicator. */
const PAGE_EDGE = 16;

/** Padding for a standard page.
 *
 * These two numbers were written out by hand in a dozen files, and had drifted
 * into five different top paddings — 12 in most places, then 8, 14, 20 and 24
 * where somebody nudged one and the rest never followed. One page should not
 * start eight pixels lower than the next for no reason anybody can name.
 *
 * `extra` is for whatever else is floating over the bottom of *this* page: pass
 * `useLiveBarInset()` on the tabs, where a running workout parks a bar above
 * the dock. It is a parameter rather than a lookup because `lib/` does not get
 * to import from `features/`. */
export function usePagePadding(extra = 0): { paddingTop: number; paddingBottom: number } {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + PAGE_TOP,
    paddingBottom: Math.max(PAGE_EDGE, insets.bottom) + PAGE_BOTTOM + extra,
  };
}

/** Top padding for a full-screen sheet. iOS puts its own chrome above one, so
 * the status bar is already accounted for; Android hands it the whole screen. */
export function useSheetTop(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? 14 : insets.top + 14;
}

/** How far a bottom drawer's paper runs on past its own bottom edge.
 *
 * iOS rounds the top corners of its keyboard, and a drawer sitting exactly on
 * that edge leaves two small wedges at the corners where the scrim shows
 * through. Rounding the drawer's own corners to match wouldn't close them, it
 * would only change their shape — so the paper carries on underneath instead,
 * and there is nothing behind the curve to see.
 *
 * The same overhang runs off the bottom of the screen when no keyboard is up,
 * which costs nothing and means a drawer never has a visible bottom edge.
 *
 * Used as a pair: add it to `paddingBottom` and subtract it as `marginBottom`,
 * so the box grows downward and the content inside does not move.
 */
export const SHEET_OVERHANG = 32;
