import { useEffect, useRef } from "react";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores";

/**
 * Subscribe to a PocketBase collection while signed in, calling `onChange` on
 * every realtime event. Holds `onChange` in a ref so callers can pass an inline
 * callback without re-subscribing on every render. SSE is a refresh channel, not
 * a data dependency — subscribe failures are swallowed.
 *
 * Transport note: the SDK's realtime layer uses the browser EventSource on the web
 * target and lynx.EventSource on native (wired in lib/pb.ts, SPEC 3); this hook is
 * transport-agnostic and works over whichever is active.
 *
 * Shared subscription (L4): every caller that follows the SAME collection shares
 * ONE PocketBase SDK subscription via the module registry below, ref-counted with
 * a deferred teardown. This is required for correctness, not just efficiency —
 * see the registry comment for the SDK churn bug it works around. Two L4 pages
 * (Today and the task page) plus the /gallery status surface all follow `tasks`
 * live, and navigating between them mounts one live page as another unmounts.
 */
export function useCollectionLive(collection: string, onChange: () => void) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    // Stable per-mount callback identity so the registry can add/remove exactly it.
    const cb = () => onChangeRef.current();
    return acquire(collection, cb);
  }, [isAuthenticated, collection]);
}

// ── Ref-counted shared realtime subscriptions ──────────────────────────────
// PocketBase 0.26.9 has a realtime churn bug: when component A unsubscribes the
// LAST listener of a topic and component B re-subscribes the SAME topic in the
// same React commit (cleanup-before-setup on a route change), the SDK's
// subscribe() takes its "already connected, first listener" path and calls
// submitSubscriptions(); but sendSubscriptions() then skips
// addAllSubscriptionListeners() because the topic is still in
// lastSentSubscriptions (A's unsubscribe hasn't flushed yet), so B's listener is
// never attached to the EventSource and realtime events silently stop.
//
// Sharing ONE SDK subscription per collection removes the churn entirely: React
// subscribers are ref-counted, and the single SDK subscribe/unsubscribe is only
// touched on the 0<->1 boundary. Teardown at count 0 is deferred a macrotask so a
// same-commit remount re-acquires (count 0->1) and cancels it, keeping the SDK
// subscription — and its EventSource listener — alive across the transition.

interface LiveEntry {
  count: number;
  listeners: Set<() => void>;
  unsub?: () => void;
  pending: boolean;
  teardown?: ReturnType<typeof setTimeout>;
}

const registry = new Map<string, LiveEntry>();

function acquire(collection: string, cb: () => void): () => void {
  let entry = registry.get(collection);
  if (!entry) {
    entry = { count: 0, listeners: new Set(), pending: false };
    registry.set(collection, entry);
  }
  const e = entry;
  e.listeners.add(cb);
  e.count++;
  if (e.teardown) {
    clearTimeout(e.teardown);
    e.teardown = undefined;
  }
  // Open the single SDK subscription the first time this collection is followed.
  if (!e.unsub && !e.pending) {
    e.pending = true;
    pb.collection(collection)
      .subscribe("*", () => {
        for (const l of e.listeners) l();
      })
      .then((u) => {
        e.pending = false;
        // If everyone unmounted while the subscribe was in flight, drop it now.
        if (e.count > 0) e.unsub = u;
        else u();
      })
      .catch(() => {
        e.pending = false;
      });
  }
  return () => {
    e.listeners.delete(cb);
    e.count--;
    if (e.count > 0) return;
    // Defer: a same-commit remount (route change) re-acquires synchronously
    // before this fires, cancelling the teardown and reusing the subscription.
    e.teardown = setTimeout(() => {
      if (e.count > 0) return;
      e.unsub?.();
      registry.delete(collection);
    }, 0);
  };
}
