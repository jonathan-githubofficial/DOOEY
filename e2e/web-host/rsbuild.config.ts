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
  server: {
    port: 4173,
    strictPort: true,
    // Serve the built Lynx web bundle next to the host so `/main.web.bundle` resolves.
    publicDir: [{ name: path.resolve(here, '../../dist'), copyOnBuild: false }],
  },
})
