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
import { initSession, signOut } from '@/features/auth/api'

// Boot side-effects (ported from src-legacy/main.tsx, minus router/query which land at
// unit 3.1). initSession() validates the persisted session on boot and only a
// definitive 4xx drops it (features/auth/api.ts); with the AsyncAuthStore seam the
// store hydrates asynchronously, so a returning session surfaces via authStore.onChange.
applyTheme(useThemeStore.getState().theme)
applyStyle()
void initSession()

// E2E-only auth bridge (unit 3.2). The app runs in the web-core worker, so specs cannot import
// signOut() directly; this mirrors src/router.tsx's PUBLIC_DOOEY_E2E-gated __dooeyRouter bridge
// and exposes signOut on the SAME worker global, so e2e/l3-auth.spec.ts drives the REAL
// signOut() API (pb.authStore.clear()) and asserts the guard reacts (onChange -> invalidate ->
// redirect to /login). PUBLIC_DOOEY_E2E is set ONLY by playwright.config.ts's webServer, so the
// bridge never ships in dev or in 8.1's prod bundle. (The 3.3 stamp UI calls the same signOut.)
if (import.meta.env.PUBLIC_DOOEY_E2E) {
  ;(globalThis as unknown as { __dooeyAuth?: { signOut: () => void } }).__dooeyAuth = { signOut }
}

root.render(<App />)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
