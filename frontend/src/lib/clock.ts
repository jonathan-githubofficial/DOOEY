import { useEffect, useState } from "react";

/** The current local minute-of-day, re-read once a minute, or null when the
 * caller does not need it (a day sheet that isn't today, a ritual list for a
 * past date). Reading the clock in render is impure — this is where the app
 * does it once, behind state, so nothing else has to.
 *
 * A minute is the resolution: everything asking is drawing a "now" thread or
 * deciding whether a slot has come due. */
export function useNowMinutes(enabled: boolean): number | null {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [enabled]);
  return enabled ? now.getHours() * 60 + now.getMinutes() : null;
}
