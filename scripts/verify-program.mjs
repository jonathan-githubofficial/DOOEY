// Verify a learning-architect bundle against DOOEY's contract BEFORE importing it.
//
// Usage:  npm run verify-program -- <dir>
//         node scripts/verify-program.mjs <dir>
//
// This imports the app's REAL parser (src/features/learning/parse.ts), so what
// passes here is exactly what the UI will render — the check can't drift from
// the app. push-program.mjs runs this first and refuses to push on any error.
//
// Exit 0 = safe to import. Exit 1 = errors found.

import { readFile, readdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED = ["PLAN.md", "SCHEDULE.md"];
const EXPECTED = ["PLAN.md", "SCHEDULE.md", "LOG.md", "TESTS.md", "DAILY-TEMPLATE.md", "calendar.ics"];

// The app's own parser — single source of truth for the schedule contract.
const { parseSchedule } = await import(
  pathToFileURL(join(ROOT, "src/features/learning/parse.ts")).href
);

export async function verifyBundle(dir) {
  const errors = [];
  const warnings = [];
  const files = {};

  let present = [];
  try {
    present = await readdir(dir);
  } catch {
    return { errors: [`Directory not found: ${dir}`], warnings: [], stats: {} };
  }

  for (const name of EXPECTED) {
    if (present.includes(name)) files[name] = await readFile(join(dir, name), "utf8");
  }

  for (const name of REQUIRED) {
    if (!files[name]) errors.push(`Missing ${name} — DOOEY can't import without it.`);
  }
  for (const name of EXPECTED) {
    if (!files[name] && !REQUIRED.includes(name)) {
      warnings.push(`No ${name} — the app will just omit it.`);
    }
  }
  if (errors.length) return { errors, warnings, stats: {} };

  // ── PLAN.md: title + why ────────────────────────────────────────────────
  const plan = files["PLAN.md"];
  const title = plan.match(/^#\s*Program:\s*(.+)$/m)?.[1].trim();
  if (!title) {
    errors.push('PLAN.md has no "# Program: <title>" heading — the app derives the folder title from it.');
  } else {
    const words = title.split(/\s+/).length;
    if (words > 5) {
      errors.push(
        `Title is ${words} words (max 5): "${title}"\n` +
          `    That's a description. Shorten "# Program:" and move the long form to "Goal:".`,
      );
    }
    if (/—|–/.test(title)) warnings.push(`Title contains a dash — usually a sign it's a description: "${title}"`);
  }
  const why = plan.match(/^Why:\s*(.+)$/m)?.[1].trim();
  if (!why) warnings.push('PLAN.md has no "Why:" line — the folder will show the category instead.');
  else if (why.split(/\s+/).length > 18) warnings.push(`"Why" is long (${why.split(/\s+/).length} words) — it truncates on the card.`);

  if (!/^##\s*Sources/m.test(plan)) {
    warnings.push("PLAN.md has no ## Sources section — grounding is a trust pillar of this skill.");
  }
  if (!/Feasibility verdict:/.test(plan)) {
    warnings.push("PLAN.md has no feasibility verdict — honesty is a trust pillar of this skill.");
  }

  // ── SCHEDULE.md: parsed with the app's parser ───────────────────────────
  const groups = parseSchedule(files["SCHEDULE.md"]);
  const sessions = groups.flatMap((g) => g.sessions);

  if (sessions.length === 0) {
    errors.push(
      "SCHEDULE.md produced 0 sessions with the app's parser.\n" +
        '    Each line must look like: - [ ] Day 1 — Mon 2026-07-13 — Topic',
    );
    return { errors, warnings, stats: {} };
  }

  const undated = sessions.filter((s) => !s.date);
  if (undated.length) {
    errors.push(
      `${undated.length} session(s) have no ISO date — no countdown/runway for them: ` +
        undated.slice(0, 3).map((s) => `"${s.label}"`).join(", "),
    );
  }
  const untopiced = sessions.filter((s) => !s.topic);
  if (untopiced.length) {
    warnings.push(`${untopiced.length} session(s) have no topic (check the " — " separators).`);
  }

  const labels = sessions.map((s) => s.label);
  const dupes = [...new Set(labels.filter((l, i) => labels.indexOf(l) !== i))];
  if (dupes.length) warnings.push(`Duplicate session labels: ${dupes.join(", ")}`);

  const dated = sessions.filter((s) => s.date);
  const outOfOrder = dated.some((s, i) => i > 0 && s.date < dated[i - 1].date);
  if (outOfOrder) warnings.push("Session dates are not in ascending order.");

  // ── Gates ───────────────────────────────────────────────────────────────
  const gates = sessions.filter((s) => s.isGate);
  if (gates.length === 0) {
    errors.push("No gates found. Progress must be gated by tests — mark gate days with ⛳ and 'GATE' in the topic.");
  }
  if (gates.length && !files["TESTS.md"]) {
    errors.push(`${gates.length} gate(s) in SCHEDULE.md but no TESTS.md — gates must have pre-written tests.`);
  } else if (gates.length) {
    const tests = files["TESTS.md"];
    for (const g of gates) {
      const num = g.topic.match(/GATE\s*(\d+)/i)?.[1];
      const isFinal = /FINAL/i.test(g.topic);
      const found = isFinal ? /final/i.test(tests) : num && new RegExp(`gate[-\\s]?${num}\\b`, "i").test(tests);
      if (!found) warnings.push(`Gate "${g.label} — ${g.topic.slice(0, 40)}" has no obvious section in TESTS.md.`);
    }
  }

  // ── calendar.ics must agree with SCHEDULE.md ────────────────────────────
  if (files["calendar.ics"]) {
    const ics = files["calendar.ics"];
    const icsDates = new Set([...ics.matchAll(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/g)].map((m) => `${m[1]}-${m[2]}-${m[3]}`));
    const schedDates = new Set(dated.map((s) => s.date));
    const missing = [...schedDates].filter((d) => !icsDates.has(d));
    const extra = [...icsDates].filter((d) => !schedDates.has(d));
    if (missing.length) errors.push(`calendar.ics is missing ${missing.length} date(s) from SCHEDULE.md: ${missing.slice(0, 3).join(", ")}`);
    if (extra.length) warnings.push(`calendar.ics has ${extra.length} date(s) not in SCHEDULE.md: ${extra.slice(0, 3).join(", ")}`);
    if (!ics.includes("\r\n")) errors.push("calendar.ics does not use CRLF line endings (required by the iCalendar spec).");
    if (!/BEGIN:VCALENDAR/.test(ics) || !/END:VCALENDAR/.test(ics)) errors.push("calendar.ics is not a valid iCalendar file.");
  }

  // ── Deadline sanity ─────────────────────────────────────────────────────
  const deadline = plan.match(/Deadline:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  const last = dated.at(-1)?.date;
  if (deadline && last && last > deadline) {
    errors.push(`Last session (${last}) is after the stated deadline (${deadline}).`);
  }

  return {
    errors,
    warnings,
    stats: {
      title,
      why,
      tracks: groups.length,
      trackNames: groups.map((g) => g.title),
      sessions: sessions.length,
      gates: gates.length,
      range: dated.length ? `${dated[0].date} → ${dated.at(-1).date}` : "—",
      files: Object.keys(files),
    },
  };
}

function report({ errors, warnings, stats }) {
  if (stats.title) {
    console.log(`\n  title    : ${stats.title}`);
    if (stats.why) console.log(`  why      : ${stats.why}`);
    console.log(`  tracks   : ${stats.tracks} → ${stats.trackNames.join(" | ")}`);
    console.log(`  sessions : ${stats.sessions}  ·  gates: ${stats.gates}`);
    console.log(`  range    : ${stats.range}`);
    console.log(`  files    : ${stats.files.join(", ")}`);
  }
  if (warnings.length) {
    console.log(`\n  ⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`    · ${w}`);
  }
  if (errors.length) {
    console.log(`\n  ✗ ${errors.length} error(s):`);
    for (const e of errors) console.log(`    · ${e}`);
    console.log("\n  Not safe to import. Fix the errors above.\n");
  } else {
    console.log(`\n  ✓ Verified — safe to import into DOOEY.\n`);
  }
}

// Run directly (not when imported by push-program).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = resolve(process.argv[2] ?? process.cwd());
  console.log(`Verifying ${dir}`);
  const result = await verifyBundle(dir);
  report(result);
  process.exit(result.errors.length ? 1 : 0);
}
