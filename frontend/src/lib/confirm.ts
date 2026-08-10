import { Alert, Platform } from "react-native";
import { openSheet } from "@/stores/sheet";

/** A destructive confirm. The phones get the OS dialog, which is what a
 * "sure?" looks like on both of them. The web gets the app's own centred card:
 * React Native Web's Alert only shows a single-button box, so a multi-button
 * confirm there would silently do nothing. */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message || undefined, [
      { text: "Cancel", style: "cancel" },
      { text: confirmLabel, style: "destructive", onPress: onConfirm },
    ]);
    return;
  }
  openSheet({
    title,
    message,
    actions: [{ label: confirmLabel, destructive: true, onPress: onConfirm }],
  });
}

/** The same "sure?" for something that isn't destructive — starting a clock,
 * committing to a thing. Same two ways of asking, no red button, because
 * nothing here is being lost. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message || undefined, [
      { text: "Not yet", style: "cancel" },
      { text: confirmLabel, onPress: onConfirm },
    ]);
    return;
  }
  openSheet({ title, message, actions: [{ label: confirmLabel, onPress: onConfirm }] });
}
