import { useEffect, useRef } from "react";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores";

/**
 * Subscribe to a PocketBase collection while signed in, calling `onChange` on
 * every realtime event. Handles the mount/unmount race so a fast unmount can't
 * leak a live subscription, and holds `onChange` in a ref so callers can pass an
 * inline callback without re-subscribing on every render. SSE is a refresh
 * channel, not a data dependency — subscribe failures are swallowed.
 */
export function useCollectionLive(collection: string, onChange: () => void) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    pb.collection(collection)
      .subscribe("*", () => onChangeRef.current())
      .then((u) => {
        if (cancelled) u();
        else unsub = u;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isAuthenticated, collection]);
}
