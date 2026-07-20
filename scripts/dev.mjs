// One command to run the whole stack: frees the ports, then starts Vite + PocketBase
// together with prefixed output and a clean shutdown.
//
// Usage:  npm run dev:all        (or the VS Code "dev" task — Ctrl+Shift+B)
//
// Ports get stuck when a previous run was killed without releasing them, so each
// port is cleared first. Only the PIDs actually LISTENING on our two ports are
// touched — never a blanket kill of node/pocketbase.

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const RSPEEDY_PORT = 3000; // matches lynx.config.ts server.port
const PB_PORT = pbPortFromEnv() ?? 8090;

function pbPortFromEnv() {
  try {
    const env = readFileSync(join(ROOT, ".env.local"), "utf8");
    const url = env.match(/^\s*VITE_PB_URL\s*=\s*(.+)$/m)?.[1].trim();
    const port = url && new URL(url).port;
    return port ? Number(port) : null;
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * PIDs listening on `port` — nothing else.
 *
 * Note: `netstat -ano -p tcp` lists IPv4 only, so a server bound to [::1] (which is
 * what Vite does on "localhost") is invisible to it. `netstat -ano` with no -p
 * reports both stacks, and both appear with the "TCP" proto label.
 */
function pidsOnPort(port) {
  try {
    if (isWin) {
      const out = execSync("netstat -ano", { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/\bLISTENING\b/i.test(line)) continue;
        // Local address is either 1.2.3.4:PORT or [::1]:PORT — take the text after the last colon.
        const m = line.match(/^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
        if (m && Number(m[2]) === port && m[3] !== "0") pids.add(m[3]);
      }
      return [...pids];
    }
    return execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    return []; // nothing listening
  }
}

/** Can we actually bind it? The only trustworthy "is it free" answer. */
function canBind(port, host) {
  return new Promise((res) => {
    const server = createServer();
    server.once("error", () => res(false));
    server.once("listening", () => server.close(() => res(true)));
    server.listen(port, host);
  });
}

const isFree = async (port) => (await canBind(port, "127.0.0.1")) && (await canBind(port, "::1"));

/**
 * Kill whatever holds `port`, then wait for the OS to actually release it.
 * taskkill returns before the socket is gone, which makes the next server
 * fail with EADDRINUSE — so we poll until it's genuinely bindable.
 */
async function freePort(port, label) {
  const pids = pidsOnPort(port).filter((pid) => Number(pid) !== process.pid);

  if (!pids.length && (await isFree(port))) {
    console.log(`\x1b[90m[dev] ${label} port ${port} is free\x1b[0m`);
    return;
  }

  // Ask each holder to die. A non-zero exit here isn't authoritative — taskkill /T
  // reports failure when a child of the tree is already gone, even though the
  // process we care about did die. The bind test below is the real answer.
  for (const pid of pids) {
    try {
      execSync(isWin ? `taskkill /F /T /PID ${pid}` : `kill -9 ${pid}`, { stdio: "ignore" });
      console.log(`\x1b[33m[dev] freed ${label} port ${port} — killed stale PID ${pid}\x1b[0m`);
    } catch {
      console.log(`\x1b[90m[dev] kill of PID ${pid} reported an error — checking the port anyway\x1b[0m`);
    }
  }

  // The OS releases the socket a moment after the process dies, so poll rather
  // than racing the next server into an EADDRINUSE.
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await isFree(port)) {
      console.log(`\x1b[33m[dev] ${label} port ${port} released\x1b[0m`);
      return;
    }
    await sleep(150);
  }

  const holders = pidsOnPort(port).join(", ") || "unknown";
  console.error(
    `\x1b[31m[dev] port ${port} (${label}) is still held by PID ${holders} after 8s.\x1b[0m\n` +
      `      Close it manually (Task Manager), or run this terminal as administrator.`,
  );
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function run(name, color, command, args) {
  // No shell: pocketbase.exe is a real binary and Vite runs via node, so we get
  // real PIDs (killable as a tree) and no arg-escaping surprises.
  const child = spawn(command, args, { cwd: ROOT });
  children.push(child);

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, to) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) to.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("error", (err) => console.error(`${prefix}failed to start: ${err.message}`));
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`${prefix}exited (${code}) — shutting the stack down`);
      shutdown(code ?? 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null || child.killed) continue;
    try {
      if (isWin) execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
      else child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// ── go ────────────────────────────────────────────────────────────────────
const pbBin = join(ROOT, "pb", isWin ? "pocketbase.exe" : "pocketbase");
const rspeedyBin = join(ROOT, "node_modules", "@lynx-js", "rspeedy", "bin", "rspeedy.js");

for (const [path, hint] of [
  [pbBin, "Download it from https://pocketbase.io/docs/ and put it in pb/."],
  [rspeedyBin, "Run `npm install` first."],
]) {
  if (!existsSync(path)) {
    console.error(`\x1b[31m[dev] not found: ${path}\x1b[0m\n      ${hint}`);
    process.exit(1);
  }
}

await freePort(PB_PORT, "backend");
await freePort(RSPEEDY_PORT, "frontend");

run("backend", "36", pbBin, ["serve", `--http=127.0.0.1:${PB_PORT}`]);
// rspeedy dev takes its port from lynx.config.ts (server.port); no CLI --port flag.
run("frontend", "35", process.execPath, [rspeedyBin, "dev"]);

console.log(
  `\x1b[90m[dev] frontend → http://localhost:${RSPEEDY_PORT}   backend → http://127.0.0.1:${PB_PORT}/_/   (Ctrl+C stops both)\x1b[0m`,
);
