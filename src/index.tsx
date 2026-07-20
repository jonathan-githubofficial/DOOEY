// URLSearchParams polyfill (crib "Routing"; SPEC 3): PrimJS lacks URLSearchParams, which
// TanStack Router's search parsing needs. A single side-effect import at the entry, BEFORE
// the router module is evaluated (App -> src/router.tsx runs createRouter on import).
import 'url-search-params-polyfill'

import '@lynx-js/preact-devtools'
import '@lynx-js/react/debug'
import { root } from '@lynx-js/react'

import { App } from './App.js'
import './styles/global.css'

import { applyTheme, useThemeStore } from '@/stores'
import { applyStyle } from '@/features/style/store'
import { initSession } from '@/features/auth/api'

// Boot side-effects (ported from src-legacy/main.tsx, minus router/query which land at
// unit 3.1). initSession() validates the persisted session on boot and only a
// definitive 4xx drops it (features/auth/api.ts); with the AsyncAuthStore seam the
// store hydrates asynchronously, so a returning session surfaces via authStore.onChange.
applyTheme(useThemeStore.getState().theme)
applyStyle()
void initSession()

root.render(<App />)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
