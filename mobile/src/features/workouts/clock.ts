import { useEffect, useState } from "react";

/** A ticking `Date.now()` — clocks derive from timestamps (never counters),
 * so backgrounding the app can't drift them. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
