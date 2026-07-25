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
