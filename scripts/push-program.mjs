// Push a learning-architect bundle straight into DOOEY's PocketBase.
//
// Usage:  node scripts/push-program.mjs <dir>          (dir defaults to cwd)
//         npm run push-program -- ./path/to/program
//
// Reads the skill's output files from <dir>, derives the goal from PLAN.md, and
// creates a `learning_programs` record owned by the account in .env.local. The
// running app picks it up live via its PocketBase realtime subscription.
//
// Requires in .env.local (gitignored):
//   VITE_PB_URL=http://127.0.0.1:8090
//   DOOEY_EMAIL=you@example.com
//   DOOEY_PASSWORD=your-app-password

import PocketBase from "pocketbase";
import { readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBundle } from "./verify-program.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROGRAM_FILES = [
  "PLAN.md",
  "SCHEDULE.md",
  "LOG.md",
  "TESTS.md",
  "DAILY-TEMPLATE.md",
  "calendar.ics",
];

/** Minimal .env.local reader — real env vars win. */
async function loadEnvLocal() {
  try {
    const txt = await readFile(join(ROOT, ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on real env vars */
  }
}

/** Same rule the app uses: PLAN.md's `# Program: <short title>` heading. */
function deriveGoal(files) {
  const plan = files["PLAN.md"] ?? "";
  const named = plan.match(/^#\s*Program:\s*(.+)$/m);
  if (named) return named[1].trim();
  const firstHeading = plan.match(/^#\s+(.+)$/m);
  if (firstHeading) return firstHeading[1].trim();
  const sched = (files["SCHEDULE.md"] ?? "").match(/^#\s+(.+)$/m);
  if (sched) return sched[1].replace(/\s*\(.*\)\s*$/, "").trim();
  return "Imported program";
}

/** PLAN.md's `Why:` line — the one-line reason, shown under the title. */
function deriveWhy(files) {
  return (files["PLAN.md"] ?? "").match(/^Why:\s*(.+)$/m)?.[1].trim() ?? "";
}

async function readBundle(dir) {
  const files = {};
  for (const name of PROGRAM_FILES) {
    try {
      files[name] = await readFile(join(dir, name), "utf8");
    } catch {
      /* optional file — skip */
    }
  }
  return files;
}

async function main() {
  await loadEnvLocal();

  const dir = resolve(process.argv[2] ?? process.cwd());
  const url = process.env.VITE_PB_URL ?? process.env.PB_URL ?? "http://127.0.0.1:8090";
  const email = process.env.DOOEY_EMAIL;
  const password = process.env.DOOEY_PASSWORD;

  if (!email || !password) {
    console.error(
      "Missing DOOEY_EMAIL / DOOEY_PASSWORD.\n" +
        "Add them to .env.local (the same account you sign into DOOEY with).",
    );
    process.exit(1);
  }

  // Verify before importing — never push a bundle the app can't render.
  const { errors, warnings } = await verifyBundle(dir);
  if (errors.length) {
    console.error(`\n✗ Refusing to push — ${errors.length} error(s) in ${dir}:`);
    for (const e of errors) console.error(`  · ${e}`);
    console.error(`\nRun: npm run verify-program -- ${process.argv[2] ?? "."}\n`);
    process.exit(1);
  }
  if (warnings.length) {
    console.warn(`⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  · ${w}`);
  }

  const files = await readBundle(dir);
  const goal = deriveGoal(files);
  const why = deriveWhy(files);
  const pb = new PocketBase(url);

  try {
    await pb.collection("users").authWithPassword(email, password);
  } catch (err) {
    console.error(
      `Could not sign in to PocketBase at ${url} as ${email}.\n` +
        `Is the server running, and does that account exist? (Create it via DOOEY's "sign in" → "new here?")\n` +
        `${err.message ?? err}`,
    );
    process.exit(1);
  }

  const record = await pb.collection("learning_programs").create({
    owner: pb.authStore.record.id,
    goal,
    why,
    files,
    progress: {},
  });

  console.log(`✓ Pushed "${goal}" to DOOEY`);
  if (why) console.log(`  why:    ${why}`);
  console.log(`  record: ${record.id}`);
  console.log(`  files:  ${Object.keys(files).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
