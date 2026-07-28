import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

/** How the `/compose` route is presented: as nothing at all.
 *
 * The drawer itself is `ComposerSheet`, the same hand-rolled bottom sheet every
 * other drawer in the app uses — a `Modal` whose host is
 * `{flex: 1, justifyContent: "flex-end"}`, so the sheet is a child that hugs
 * its content and gets pushed to the bottom. Height comes from the form. It
 * cannot be wrong.
 *
 * It used to be a native UIKit `formSheet`, and that made it the only drawer in
 * the app whose height came from somewhere other than its content: first from
 * fractional detents (a guess at how tall the form is), then from
 * `fitToContents` (correct in principle, and dependent on a native path that
 * can only be checked on a device). Every other drawer — the scheduling sheet,
 * the exercise picker, the program deck, the action sheets — hugs its content
 * and has never shown a slab of empty paper. Now this one is the same thing.
 *
 * So the route contributes only transparency: no background to flash behind the
 * modal, and no screen animation, because the sheet slides itself. */
export const COMPOSE_SHEET: NativeStackNavigationOptions = {
  presentation: "transparentModal",
  animation: "none",
  contentStyle: { backgroundColor: "transparent" },
};
