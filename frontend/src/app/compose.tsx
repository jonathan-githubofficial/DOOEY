import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Platform } from "react-native";
import { ComposerSheet } from "@/features/tasks/components/TaskComposer";
import { localDate } from "@/lib/dates";
import { useAuthStore } from "@/stores/auth";

/** The new-task drawer.
 *
 * A route so a timeboxed slot tap and a deep link both have somewhere to go,
 * but the drawer is `ComposerSheet` — the app's own bottom sheet, the same one
 * the scheduling drawer and the pickers use. It is a `Modal` that hugs its
 * content, so the sheet is exactly as tall as the form and no taller.
 *
 * This was a native `formSheet` until 2026-07-27, which made it the only drawer
 * whose height was decided by something other than its content, and the only
 * one that showed empty paper under the fields. */
export default function Compose() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { date, start } = useLocalSearchParams<{ date?: string; start?: string }>();

  if (!isAuthenticated) return <Redirect href="/login" />;
  // On the web the composer lives at /compose; a page reload would land on a
  // contextless sheet with nothing behind it. If there's no history to close
  // back into, send them back to the Planner — the composer is its drill-in.
  if (Platform.OS === "web" && !router.canGoBack()) return <Redirect href="/" />;

  return (
    <ComposerSheet
      date={date ?? localDate()}
      initialStart={start ? Number(start) : undefined}
      onClose={() => router.back()}
    />
  );
}
