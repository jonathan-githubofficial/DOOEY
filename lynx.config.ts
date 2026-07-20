import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginTypeCheck } from '@rsbuild/plugin-type-check'
import { pluginTailwindCSS } from 'rsbuild-plugin-tailwindcss'
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    pluginQRCode({
      schema(url) {
        // `?fullscreen=true` opens the page in LynxExplorer in full screen mode.
        return `${url}?fullscreen=true`
      },
    }),
    pluginReactLynx(),
    pluginTailwindCSS({
      config: './tailwind.config.ts',
      // Keep tailwind-merge as a dep (PLAN 8) but stop the plugin from scanning
      // its raw Tailwind source (known class-flooding gotcha).
      exclude: [/[\\/]node_modules[\\/]tailwind-merge[\\/]/],
    }),
    pluginLynxConfig({
      // Inline CSS variables so the design tokens resolve on the web target.
      enableCSSInlineVariables: true,
    }),
    pluginTypeCheck(),
  ],
  // The web target is the only target this run verifies; it must emit output.
  environments: {
    web: {},
  },
  output: {
    // Root-relative prefix for emitted assets, matching how every web host serves `dist/`
    // (e2e 4173, fidelity 4175, 8.1 prod same-origin). Without it, most CSS `url(...)`
    // refs bake as `webpack:///static/...` (an invalid runtime scheme).
    assetPrefix: '/',
    // The @font-face `src: url(...)` refs are NOT rewritten by assetPrefix on this
    // rspeedy/web pipeline - they stay `webpack:///static/font/*.woff2`, so every font
    // fails to load (ERR_UNKNOWN_URL_SCHEME / CORS) and text falls back to serif/system.
    // Inline the woff2 files (and the paper-grain PNG) as data URIs instead: self-contained,
    // no URL resolution, so they load on any host. dataUriLimit is a byte ceiling per asset
    // type; the fonts are ~13-40 kB each and the grain PNG ~76 kB, so a 1 MB font ceiling
    // and 128 kB image ceiling inline exactly these without pulling in anything larger.
    dataUriLimit: { font: 1_000_000, image: 131_072 },
  },
  source: {
    alias: {
      // React-18/19 compat: TanStack Query/Router and other React-18 libraries resolve to
      // ReactLynx's compat layer (startTransition / useSyncExternalStore). Unit 3.1 points this
      // at a thin shim (src/lib/react-compat.ts) that re-exports compat AND adds React 19's
      // optional `use` (as undefined) so Rspack's strict ESM linker resolves TanStack Router
      // 1.170's `React["use"]` reference instead of failing the build. See that file's header.
      react$: path.resolve(__dirname, './src/lib/react-compat.ts'),
      // Ported `@/...` imports resolve to the new src tree.
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Deterministic dev port (scripts/dev.mjs frees this before launching).
    port: 3000,
  },
})
