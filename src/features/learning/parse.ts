import type { ScheduleGroup, ScheduleSession } from "./types";

const HEADER = /^#{1,3}\s+(.*)$/;
const CHECKBOX = /^-\s*\[( |x|X)\]\s+(.*)$/;
const ISO_DATE = /(\d{4}-\d{2}-\d{2})/;
// Spaced dash (em, en, or hyphen). The spaces are required, so ISO dates
// (2026-07-13) are never split on their own hyphens.
const SEP = /\s+[—–-]\s+/;

/**
 * Parse SCHEDULE.md into tickable groups. The skill's format is:
 *   ## Phase 1 — Survival
 *   - [ ] Day 1 — Mon 2026-07-13 — Politesse …
 *   - [ ] ⛳ Day 7 — Sun 2026-07-19 — GATE 1: …
 * We're tolerant: any `## ` header opens a group, any checkbox line is a session.
 */
export function parseSchedule(scheduleMd: string | undefined): ScheduleGroup[] {
  if (!scheduleMd) return [];
  const groups: ScheduleGroup[] = [];
  let current: ScheduleGroup | null = null;

  const lines = scheduleMd.split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;

    const checkbox = line.match(CHECKBOX);
    if (checkbox) {
      if (!current) {
        current = { title: "Schedule", sessions: [] };
        groups.push(current);
      }
      current.sessions.push(
        toSession(
          checkbox[2],
          checkbox[1].toLowerCase() === "x",
          `g${groups.length - 1}-s${current.sessions.length}`,
          index,
        ),
      );
      return;
    }

    const header = line.match(HEADER);
    // A top-level `# SCHEDULE` title isn't a group; only open groups on ## / ###.
    if (header && (line.startsWith("## ") || line.startsWith("### "))) {
      current = { title: header[1].trim(), sessions: [] };
      groups.push(current);
    }
  });

  return groups.filter((g) => g.sessions.length > 0);
}

function toSession(text: string, doneInFile: boolean, key: string, line: number): ScheduleSession {
  const isGate = text.includes("⛳") || /\bGATE\b/.test(text);
  const clean = text.replace(/⛳/g, "").trim();
  const date = clean.match(ISO_DATE)?.[1] ?? null;

  const parts = clean.split(SEP);
  const label = parts[0]?.trim() ?? clean;
  let dateRaw = "";
  let topic = "";
  if (parts.length >= 3) {
    dateRaw = parts[1].trim();
    topic = parts.slice(2).join(" — ").trim();
  } else if (parts.length === 2) {
    // Two segments: either "label — date" or "label — topic".
    if (ISO_DATE.test(parts[1])) dateRaw = parts[1].trim();
    else topic = parts[1].trim();
  }

  return { key, label, date, dateRaw, topic, isGate, doneInFile, line };
}
