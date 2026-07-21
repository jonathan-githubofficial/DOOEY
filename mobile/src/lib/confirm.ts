import { Alert, Platform } from "react-native";

/** A destructive confirm that works on web too. React Native Web's Alert only
 * shows a single-button box — multi-button confirms silently do nothing — so
 * on web we fall back to the browser's own confirm. */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
) {
  if (Platform.OS === "web") {
    const ok =
      typeof window !== "undefined" && window.confirm(message ? `${title}\n\n${message}` : title);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message || undefined, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
