import { spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'

import { PID_FILE } from './pb-env'

// Stop the disposable PocketBase cleanly (no orphan left listening on 8091). The data dir
// is deliberately LEFT in place - the charter forbids hand-deleting; a reset is a NEW dir.

interface GlobalWithPb {
  __PB_E2E_CHILD__?: ChildProcess
}

/** Force-kill a Windows process tree by pid (taskkill /T covers PocketBase child procs). */
function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/F', '/T'], { windowsHide: true })
  } else {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
}

export default async function globalTeardown(): Promise<void> {
  const child = (globalThis as GlobalWithPb).__PB_E2E_CHILD__
  if (child?.pid) {
    killTree(child.pid)
  }

  // Belt-and-suspenders: kill by the recorded pid too (covers a fresh runner process).
  if (existsSync(PID_FILE)) {
    const pid = Number.parseInt(readFileSync(PID_FILE, 'utf8').trim(), 10)
    if (Number.isFinite(pid)) killTree(pid)
    rmSync(PID_FILE, { force: true })
  }
}
