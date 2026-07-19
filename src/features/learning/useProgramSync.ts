import { useEffect } from "react";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores";
import { useLearningStore } from "./store";

/**
 * Keeps programs in step with PocketBase while signed in: pulls on mount, then
 * re-syncs on any realtime change. This is how a bundle pushed from a Claude Code
 * session (`npm run push-program`) shows up in the UI without a reload.
 */
export function useProgramSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncWithPB = useLearningStore((s) => s.syncWithPB);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    syncWithPB();

    const subscription = pb
      .collection("learning_programs")
      .subscribe("*", () => {
        if (active) syncWithPB();
      })
      .catch((e) => {
        console.warn("[learning] realtime subscribe failed:", e);
        return null;
      });

    return () => {
      active = false;
      subscription.then((unsubscribe) => unsubscribe?.()).catch(() => {});
    };
  }, [isAuthenticated, syncWithPB]);
}
