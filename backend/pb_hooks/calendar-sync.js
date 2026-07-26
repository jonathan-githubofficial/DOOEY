// Syncs Google Calendar events for all users who have a calendar_link.
// Runs every 10 minutes.
//
// Prerequisites (set in PocketBase Admin → Settings → Auth providers):
//   - Google OAuth enabled with scope: https://www.googleapis.com/auth/calendar.readonly
//   - Store refresh_token in calendar_links.refresh_token_encrypted (encrypt at rest
//     using $app.newAes256Cipher(env["CALENDAR_ENC_KEY"])).
//
// The write-back hook (task → Google event) lives in calendar-writeback.js (Phase 3).

cronAdd("calendar-sync", "*/10 * * * *", function () {
  const links = $app.findAllRecords("calendar_links");

  for (const link of links) {
    try {
      syncUserCalendar(link);
    } catch (e) {
      console.error("[calendar-sync] failed for link", link.getId(), e);
    }
  }
});

function syncUserCalendar(link) {
  const encKey = $os.getenv("CALENDAR_ENC_KEY");
  const cipher = $app.newAes256Cipher(encKey);

  const encryptedToken = link.getString("refresh_token_encrypted");
  const refreshToken = cipher.decrypt(encryptedToken);

  // Exchange refresh token for a fresh access token
  const tokenRes = $http.send({
    method: "POST",
    url: "https://oauth2.googleapis.com/token",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${$os.getenv("GOOGLE_CLIENT_ID")}&client_secret=${$os.getenv("GOOGLE_CLIENT_SECRET")}`,
  });

  if (tokenRes.statusCode !== 200) {
    throw new Error("token exchange failed: " + tokenRes.raw);
  }

  const tokenData = tokenRes.json;
  const accessToken = tokenData.access_token;
  const calendarId = link.getString("calendar_id") || "primary";
  const userId = link.getString("user");

  // Fetch events in a rolling 30-day window
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 1); // yesterday for catch-up
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 30);

  const eventsRes = $http.send({
    method: "GET",
    url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${windowStart.toISOString()}&timeMax=${windowEnd.toISOString()}&singleEvents=true&maxResults=250&orderBy=startTime`,
    headers: { Authorization: "Bearer " + accessToken },
  });

  if (eventsRes.statusCode !== 200) {
    throw new Error("events fetch failed: " + eventsRes.raw);
  }

  const items = eventsRes.json.items || [];

  for (const item of items) {
    if (item.status === "cancelled") continue;
    const startAt = item.start?.dateTime || item.start?.date;
    const endAt = item.end?.dateTime || item.end?.date;
    if (!startAt || !endAt) continue;

    // Upsert: try update, fall back to create
    try {
      const existing = $app.findFirstRecordByFilter(
        "calendar_events",
        `user = "${userId}" && external_id = "${item.id}"`,
      );
      existing.set("title", item.summary || "");
      existing.set("start_at", new Date(startAt).toISOString());
      existing.set("end_at", new Date(endAt).toISOString());
      $app.save(existing);
    } catch (_) {
      const evCol = $app.findCollectionByNameOrId("calendar_events");
      const rec = new Record(evCol);
      rec.set("user", userId);
      rec.set("external_id", item.id);
      rec.set("title", item.summary || "");
      rec.set("start_at", new Date(startAt).toISOString());
      rec.set("end_at", new Date(endAt).toISOString());
      rec.set("calendar_id", calendarId);
      $app.save(rec);
    }
  }

  // Update last_sync_at
  link.set("last_sync_at", new Date().toISOString());
  $app.save(link);
}
