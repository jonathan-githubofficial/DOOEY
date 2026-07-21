import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@rsbuild/core'

// Static host for the E2E oracle: bundles `web-host/index.ts` (the web-core runtime +
// <lynx-view> mount) and serves the built Lynx web bundle from `dist/` next to it, so
// `/main.web.bundle` resolves same-origin with the host page. Playwright's webServer runs
// `npm run build && rsbuild dev -c e2e/web-host/rsbuild.config.ts` (see playwright.config.ts):
// the app bundle is rebuilt first with PUBLIC_PB_URL pointed at the disposable PB (8091),
// then this server serves it on 4173. Run from the worktree root so node_modules resolves.
const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  source: {
    entry: { index: path.resolve(here, 'index.ts') },
  },
  // Deterministic test oracle, NOT a developer loop: disable HMR and live-reload. `rsbuild
  // dev` otherwise injects @rsbuild/core's HMR client into EVERY chunk - including the Web
  // Worker chunk that @lynx-js/web-core spins up to run the Lynx app. When a background
  // rebuild lands mid-test, that worker-side client calls a bareword `location.reload()`;
  // in a worker `self.location` is a WorkerLocation with no `reload`, throwing an uncaught
  // "TypeError: location.reload is not a function" (and, when it does resolve, reloading the
  // page mid-assertion - a flake). Tests serve a pre-built static bundle, so neither HMR nor
  // live-reload is wanted here. (L2-design-gate-fix; benefits every layer's E2E run.)
  dev: {
    hmr: false,
    liveReload: false,
  },
  server: {
    port: 4173,
    strictPort: true,
    // Serve the built Lynx web bundle next to the host so `/main.web.bundle` resolves.
    publicDir: [{ name: path.resolve(here, '../../dist'), copyOnBuild: false }],
  },
})
