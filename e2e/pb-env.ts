import path from 'node:path'

// Shared constants for the E2E oracle. Every path is resolved from the worktree root
// (process.cwd() when `npx playwright test` runs), so setup, teardown and fixtures agree.
//
// Ports: the disposable PB is 8091 (NOT 8090 - that is the operator's dev PB and must not
// collide). The served web output is 4173.

/** The disposable PocketBase base URL. Never the operator's :8090 instance. */
export const PB_URL = 'http://127.0.0.1:8091'

/** The served Lynx web output (rsbuild dev host, see e2e/web-host/). */
export const APP_URL = 'http://127.0.0.1:4173'

const ROOT = process.cwd()

/** The ONLY mutable directory. pb/pb_data (the operator's real data) is untouchable. */
export const SCRATCH_DIR = path.resolve(ROOT, '.scratch/pb-e2e')

/** The real PocketBase binary (killable, gitignored). */
export const PB_BIN = path.resolve(ROOT, 'pb/pocketbase.exe')

/** Read-only schema + hooks sources (HARD RULE: never modified by the E2E run). */
export const MIGRATIONS_DIR = path.resolve(ROOT, 'pb/pb_migrations')
export const HOOKS_DIR = path.resolve(ROOT, 'pb/pb_hooks')

/** Generated-at-runtime credentials, gitignored via .scratch. Never .env.local. */
export const CREDS_FILE = path.join(SCRATCH_DIR, 'creds.json')

/** PID of the serve process, so an operator can kill an orphan by hand if needed. */
export const PID_FILE = path.join(SCRATCH_DIR, 'pb.pid')

export interface Account {
  email: string
  password: string
}

export interface E2ECreds {
  pbUrl: string
  dataDir: string
  superuser: Account
  user: Account & { id: string }
}
