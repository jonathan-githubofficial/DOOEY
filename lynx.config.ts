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
