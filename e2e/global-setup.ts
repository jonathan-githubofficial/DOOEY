import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, openSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import PocketBase from 'pocketbase'

import {
  CREDS_FILE,
  PB_BIN,
  PB_URL,
  PID_FILE,
  SCRATCH_DIR,
  HOOKS_DIR,
  MIGRATIONS_DIR,
  type E2ECreds,
} from './pb-env'

// ── The disposable PocketBase (charter oracle) ───────────────────────────────────────
// Everything here targets a FRESH, throwaway data dir under .scratch/pb-e2e/ on port 8091.
// The operator's real pb/pb_data (port 8090) is NEVER served, read, copied or deleted.
// Schema comes read-only from pb/pb_migrations; the hooks load read-only from pb/pb_hooks.
// We seed only RECORDS (superuser + a test user), never collections, so PocketBase's
// automigrate never writes a stray migration back into pb/pb_migrations (Phase 0 spike
// warning). Reset = a NEW timestamped dir; nothing is ever hand-deleted (charter).

/** A password that satisfies PocketBase's length rules, URL-safe, no shell-hostile chars. */
function randomPassword(): string {
  return randomBytes(24).toString('base64url')
}

function randomEmail(prefix: string): string {
  return `${prefix}+${randomBytes(6).toString('hex')}@dooey.test`
}

async function waitForHealth(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return true
    } catch {
      // server not up yet - keep polling
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

export default async function globalSetup(): Promise<void> {
  mkdirSync(SCRATCH_DIR, { recursive: true })

  // Fresh, timestamped data dir per run (never reuse, never hand-delete).
  const dataDir = path.join(SCRATCH_DIR, `pb_data-${Date.now()}`)

  const creds: E2ECreds = {
    pbUrl: PB_URL,
    dataDir,
    superuser: { email: randomEmail('e2e-su'), password: randomPassword() },
    user: { email: randomEmail('e2e-user'), password: randomPassword(), id: '' },
  }

  // 1. Build the data dir + seed the superuser NON-INTERACTIVELY. `superuser upsert` runs
  //    the migrations against the fresh dir (verified: collections exist afterwards), then
  //    creates the superuser. Idempotent by design.
  const upsert = spawnSync(
    PB_BIN,
    [
      'superuser',
      'upsert',
      creds.superuser.email,
      creds.superuser.password,
      '--dir',
      dataDir,
      '--migrationsDir',
      MIGRATIONS_DIR,
    ],
    { encoding: 'utf8', windowsHide: true },
  )
  if (upsert.status !== 0) {
    throw new Error(
      `[e2e] superuser upsert failed (code ${upsert.status}):\n${upsert.stdout}\n${upsert.stderr}`,
    )
  }

  // 2. Serve the disposable instance on 8091 with the real migrations + hooks (read-only).
  const logFile = path.join(SCRATCH_DIR, `pb-serve-${Date.now()}.log`)
  const logFd = openSync(logFile, 'a')
  const child: ChildProcess = spawn(
    PB_BIN,
    [
      'serve',
      '--http',
      '127.0.0.1:8091',
      '--dir',
      dataDir,
      '--migrationsDir',
      MIGRATIONS_DIR,
      '--hooksDir',
      HOOKS_DIR,
    ],
    { stdio: ['ignore', logFd, logFd], windowsHide: true },
  )
  child.unref()
  // Stash the handle + pid so global-teardown (same process) can stop it, and the pid file
  // lets an operator kill an orphan by hand.
  ;(globalThis as GlobalWithPb).__PB_E2E_CHILD__ = child
  if (child.pid) writeFileSync(PID_FILE, String(child.pid), 'utf8')

  // 3. calendar-sync.js soft-fail check (SPEC 6): the hook loads at boot. If it crashed the
  //    instance, health would never come up -> we surface the log instead of patching pb_hooks.
  if (!(await waitForHealth(PB_URL, 25_000))) {
    throw new Error(
      `[e2e] disposable PocketBase never became healthy on ${PB_URL}. ` +
        `If pb_hooks/calendar-sync.js crashed the instance this is a FINDING for a human ` +
        `ruling (do NOT patch pb_hooks). See ${logFile}`,
    )
  }

  // 4. Seed a test app user via the SDK as the superuser, then satisfy verification from the
  //    client (never relax the migration). This user owns every record the specs create.
  const pb = new PocketBase(PB_URL)
  pb.autoCancellation(false)
  await pb.collection('_superusers').authWithPassword(creds.superuser.email, creds.superuser.password)

  const created = await pb.collection('users').create({
    email: creds.user.email,
    password: creds.user.password,
    passwordConfirm: creds.user.password,
  })
  // Mark verified from the superuser so authWithPassword is never gated by verification.
  await pb.collection('users').update(created.id, { verified: true })
  creds.user.id = created.id

  // 5. Persist creds for the fixtures (gitignored via .scratch; NEVER pb/pb_data or .env.local).
  writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2), 'utf8')

  // Final health re-check: confirms the instance stayed up after the first cron wiring.
  if (!(await waitForHealth(PB_URL, 5_000))) {
    throw new Error(`[e2e] disposable PocketBase went unhealthy after seeding. See ${logFile}`)
  }
}

interface GlobalWithPb {
  __PB_E2E_CHILD__?: ChildProcess
}
