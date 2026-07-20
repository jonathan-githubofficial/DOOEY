import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src-legacy is READ-ONLY reference (Vite/React-DOM, not Lynx types); pb/ is
  // PocketBase's world (generated types + server hooks with PB globals); dist is
  // build output; .scratch is disposable; .agents is untracked local Claude/skill
  // tooling (not repo source, ships its own .cjs loaders that trip TS-only rules).
  globalIgnores(['dist', 'pb', 'src-legacy', '.scratch', 'docs', '.agents']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // The E2E harness (unit 1.5) and the Playwright config run in Node (global-setup spawns
    // PocketBase, fixtures read the filesystem) and drive a browser (page.evaluate callbacks
    // use DOM globals), so both environments are in scope here.
    files: ['e2e/**/*.{ts,tsx}', 'playwright.config.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // No React here; the react-hooks plugin otherwise mis-flags Playwright's `use()`
      // fixture callback as the React 19 `use` hook.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])
