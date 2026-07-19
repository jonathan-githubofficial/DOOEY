import { useEffect } from "react";
import { useCollectionLive } from "@/lib/useCollectionLive";
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
    if (isAuthenticated) syncWithPB();
  }, [isAuthenticated, syncWithPB]);

  useCollectionLive("learning_programs", syncWithPB);
}
