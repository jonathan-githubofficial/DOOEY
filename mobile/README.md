# DOOEY mobile — Expo / React Native

The React Native port of DOOEY, built with Expo + expo-router and shipped with EAS.
Same PocketBase backend, same records, same doodles — a task checked here is checked
on the web app and vice versa.

## What's here so far

- **Auth** (`src/app/login.tsx`) — email + password sign in / sign up; the session
  persists in AsyncStorage and every tab lives behind a guard.
- **Planner** (`src/app/(tabs)/index.tsx`) — week ribbon, the ring-bound planner
  book with page-flip, check-off, long-press to delete, floating stamp composer.
- **Calendar** (`src/app/(tabs)/calendar.tsx`) — day/week/month views: the timeboxed
  day sheet (tap an hour to add, shelf for unscheduled), the week spread, the month
  grid with open-task dots, and a time-zoom stepper.
- **Doodling** (`src/components/Doodle*.tsx`) — the pad, four inks, pen/eraser/undo.
  Strokes share the web app's format (% points), so avatars round-trip.
- **Account** (`src/app/(tabs)/account.tsx`) — doodled avatar, light/dark toggle,
  sign out, and the door to the Style studio.
- **Style studio** (`src/app/(tabs)/style.tsx`) — presets, per-token colour mixing,
  page doodles (synced to the user record), fonts, corners/grain/shadow.

Not ported yet: task pages, boards, projects/learning, Google Calendar sync,
drag-to-move/resize timeboxes, PocketBase realtime (React Native has no
EventSource — needs a polyfill; lists refetch on mutation instead).

## Run it

```bash
npm install
npm start          # Expo dev server — press a for Android, i for iOS, w for web
```

PocketBase must be running (`pb/pocketbase.exe serve` from the repo root). The API
host resolves in this order:

1. `EXPO_PUBLIC_PB_URL` — **required for a physical device**, e.g.
   `EXPO_PUBLIC_PB_URL=http://192.168.1.20:8090 npm start`
2. Android emulator fallback: `http://10.0.2.2:8090`
3. iOS simulator / web fallback: `http://127.0.0.1:8090`

## Build & ship (EAS)

```bash
npx eas login
npx eas build --profile preview --platform android   # installable APK/IPA
npx eas build --profile production --platform all
```

Profiles live in `eas.json`; set the real production host in the profiles'
`EXPO_PUBLIC_PB_URL` (currently a placeholder). The first build will prompt EAS to
create the project and fill in `extra.eas.projectId`.
