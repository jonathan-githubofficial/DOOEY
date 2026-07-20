import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginTypeCheck } from '@rsbuild/plugin-type-check'
import { pluginTailwindCSS } from 'rsbuild-plugin-tailwindcss'
import { pluginLynxConfig } from '@lynx-js/config-rsbuild-plugin'

const require = createRequire(import.meta.url)
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
      // React-18 compat: TanStack Query/Router and other React-18 libraries
      // resolve to ReactLynx's compat layer (startTransition / useSyncExternalStore).
      react$: require.resolve('@lynx-js/react/compat'),
      // Ported `@/...` imports resolve to the new src tree.
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Deterministic dev port (scripts/dev.mjs frees this before launching).
    port: 3000,
  },
})
