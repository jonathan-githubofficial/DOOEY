import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// The DOOEY touch language: small, physical, never buzzy. Web is a no-op.
const on = Platform.OS !== "web";

/** A light tick — checks, chips, small buttons, a row settling. */
export const hapticTap = () => {
  if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/** A firmer thunk — picking something up (drag lift). */
export const hapticLift = () => {
  if (on) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/** Something good landed — a task created, a program finished. */
export const hapticSuccess = () => {
  if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/** A destructive edge — the delete under a swiped row. */
export const hapticWarn = () => {
  if (on) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};
