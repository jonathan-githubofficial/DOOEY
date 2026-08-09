/** The parse-loop policy, kept pure so it can be tested without timers or
 * network: one request in flight at a time, each stamped with a rising rev,
 * and a response applied only if it is the newest one sent — a slow provider
 * can never regress the draft. `dirty` remembers that the transcript moved
 * while a request was flying, so the landing fires the next one. */

export interface LoopState {
  /** Highest rev handed out. */
  sent: number;
  /** Rev of the draft currently on screen. */
  applied: number;
  inFlight: boolean;
  /** Transcript changed mid-flight; refire on landing. */
  dirty: boolean;
}

export const initialLoop: LoopState = {
  sent: 0,
  applied: 0,
  inFlight: false,
  dirty: false,
};

/** The transcript changed. Only meaningful mid-flight; the caller's debounce
 * decides when an idle loop actually fires. */
export function changed(s: LoopState): LoopState {
  return s.inFlight ? { ...s, dirty: true } : s;
}

/** Launch a request, or refuse while one is flying (the landing refires). */
export function fire(s: LoopState): { state: LoopState; rev: number } | null {
  if (s.inFlight) return null;
  const rev = s.sent + 1;
  return { state: { ...s, sent: rev, inFlight: true, dirty: false }, rev };
}

/** A response landed. */
export function landed(
  s: LoopState,
  rev: number,
): { state: LoopState; apply: boolean; refire: boolean } {
  const apply = rev === s.sent && rev > s.applied;
  return {
    state: { ...s, inFlight: false, applied: apply ? rev : s.applied },
    apply,
    refire: s.dirty,
  };
}

/** A request failed; the last good draft stays. */
export function failed(s: LoopState): { state: LoopState; refire: boolean } {
  return { state: { ...s, inFlight: false }, refire: s.dirty };
}
