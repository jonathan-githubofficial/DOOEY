/** One tickable line of a program's SCHEDULE.md. */
export interface ScheduleSession {
  key: string;
  label: string;
  date: string | null;
  topic: string;
  isGate: boolean;
  doneInFile: boolean;
  /** Index of this session's line in the file — part of its sort order. */
  line: number;
}

export interface ScheduleGroup {
  title: string;
  sessions: ScheduleSession[];
}

const HEADER = /^#{1,3}\s+(.*)$/;
const CHECKBOX = /^-\s*\[( |x|X)\]\s+(.*)$/;
const ISO_DATE = /(\d{4}-\d{2}-\d{2})/;
// Spaced dash (em, en, or hyphen). The spaces are required, so ISO dates
// (2026-07-13) are never split on their own hyphens.
const SEP = /\s+[—–-]\s+/;

/**
 * Parse SCHEDULE.md into tickable groups. The learning-architect skill's format
 * is:
 *   ## Phase 1 — Survival
 *   - [ ] Day 1 — Mon 2026-07-13 — Politesse …
 *   - [ ] ⛳ Day 7 — Sun 2026-07-19 — GATE 1: …
 * We're tolerant: any `## ` header opens a group, any checkbox line is a
 * session.
 *
 * Ported from the retired web app, character for character on the parsing
 * rules — `session_key` is derived from group and session index, so a parser
 * that grouped differently would re-materialize every session as a duplicate.
 */
export function parseSchedule(scheduleMd: string | undefined): ScheduleGroup[] {
  if (!scheduleMd) return [];
  const groups: ScheduleGroup[] = [];
  let current: ScheduleGroup | null = null;

  scheduleMd.split(/\r?\n/).forEach((raw, index) => {
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
  let topic = "";
  if (parts.length >= 3) topic = parts.slice(2).join(" — ").trim();
  // Two segments: either "label — date" or "label — topic".
  else if (parts.length === 2 && !ISO_DATE.test(parts[1])) topic = parts[1].trim();

  return { key, label, date, topic, isGate, doneInFile, line };
}
