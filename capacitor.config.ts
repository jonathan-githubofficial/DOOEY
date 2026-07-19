import type { CapacitorConfig } from "@capacitor/cli";

// The native apps are thin shells around the same Vite build (`dist/`).
// `npm run mobile:sync` rebuilds the web app and copies it into both shells.
// Remember: a device can't reach 127.0.0.1 — build with VITE_PB_URL pointing
// at the real PocketBase host before syncing.
const config: CapacitorConfig = {
  appId: "com.dooey.app",
  appName: "DOOEY",
  webDir: "dist",
};

export default config;
