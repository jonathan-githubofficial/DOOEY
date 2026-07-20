import type { Config } from 'tailwindcss'

import { createLynxPreset } from '@lynx-js/tailwind-preset'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  // uiVariants replaces pseudo / data-attr selectors for component states
  // (keep the default `ui-*` prefixes for now — PLAN 5.1, crib sheet).
  presets: [createLynxPreset({ lynxUIPlugins: { uiVariants: {} } })],
  theme: {
    extend: {
      colors: {
        paper: 'hsl(var(--paper))',
        surface: 'hsl(var(--surface))',
        ink: 'hsl(var(--ink))',
        'ink-muted': 'hsl(var(--ink-muted))',
        rule: 'hsl(var(--rule))',
        leaf: 'hsl(var(--leaf))',
        zest: 'hsl(var(--zest))',
        sky: 'hsl(var(--sky))',
        clay: 'hsl(var(--clay))',
        honey: 'hsl(var(--honey))',
      },
      fontFamily: {
        sans: 'var(--app-font-sans)',
        display: 'var(--app-font-display)',
      },
      borderRadius: {
        card: 'var(--app-radius-card)',
      },
    },
  },
}

export default config
