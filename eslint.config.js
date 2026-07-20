import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src-legacy is READ-ONLY reference (Vite/React-DOM, not Lynx types); pb/ is
  // PocketBase's world (generated types + server hooks with PB globals); dist is
  // build output; .scratch is disposable.
  globalIgnores(['dist', 'pb', 'src-legacy', '.scratch', 'docs']),
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
])
