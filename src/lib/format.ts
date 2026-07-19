/** Format a UTC date string into the user's local timezone. */
export function formatLocal(
  isoUtc: string,
  timezone: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat("en", { ...opts, timeZone: timezone }).format(
    new Date(isoUtc),
  );
}

export function formatTime(isoUtc: string, timezone: string): string {
  return formatLocal(isoUtc, timezone, { hour: "numeric", minute: "2-digit" });
}

export function formatDate(isoUtc: string, timezone: string): string {
  return formatLocal(isoUtc, timezone, { month: "short", day: "numeric" });
}

export function relativeTime(isoUtc: string): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = new Date(isoUtc).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  return rtf.format(Math.round(diffHr / 24), "day");
}
