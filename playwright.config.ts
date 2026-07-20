import { defineConfig, devices } from '@playwright/test'

// E2E oracle config (unit 1.5). The disposable PocketBase (127.0.0.1:8091) is launched by
// e2e/global-setup.ts and stopped by e2e/global-teardown.ts. The built Lynx web output is
// served on 127.0.0.1:4173 by the webServer below, which FIRST rebuilds the app bundle with
// PUBLIC_PB_URL pointed at the disposable PB (import.meta.env is compile-time), then serves
// it via the web-core host (e2e/web-host/). Layer tags: `npx playwright test --grep @l1`.

const APP_URL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'line',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Rebuild the app bundle with the disposable PB URL, then serve host + bundle on 4173.
    command: 'npm run build && npx rsbuild dev -c e2e/web-host/rsbuild.config.ts',
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // PUBLIC_PB_URL points the app's PB client at the disposable instance (compile-time).
    // PUBLIC_DOOEY_E2E (unit 3.1) is the E2E-only flag that makes src/router.tsx expose the
    // `__dooeyRouter` bridge on the worker global - memory history has no address bar, so specs
    // navigate via the bridge. `rspeedy build` runs in production mode, so a `MODE` gate would
    // be false here; this dedicated PUBLIC_ flag is set ONLY by this webServer (never dev/prod).
    env: { PUBLIC_PB_URL: 'http://127.0.0.1:8091', PUBLIC_DOOEY_E2E: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
