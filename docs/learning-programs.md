# Learning programs: authoring and import

How a learning program built with the **learning-architect** skill gets into DOOEY's database.
Do not hand the user files to import by hand: verify the bundle, then push it.

```bash
npm run verify-program -- <dir>   # checks the bundle against the app's real parser
npm run push-program   -- <dir>   # verifies again, then writes it to PocketBase
```

Both scripts live at the repo root (`scripts/verify-program.mjs`, `scripts/push-program.mjs`).

## What verification covers

`verify-program` imports the app's own `src/features/learning/parse.ts`, so whatever passes is
exactly what the UI renders. It checks the 5-word-maximum title, the `Why:` line, ISO dates, gate
markers with matching tests, and that `calendar.ics` agrees with `SCHEDULE.md`.

**push-program refuses to push on any error.** Never bypass it; fix the bundle.

## What push does

It reads `PLAN.md`, `SCHEDULE.md`, `TESTS.md`, `DAILY-TEMPLATE.md`, `LOG.md` and `calendar.ics`
from the directory, derives the goal from PLAN.md's `# Program:` heading, and creates a
`learning_programs` record.

Prerequisites: PocketBase running (`pb/pocketbase.exe serve`), and `DOOEY_EMAIL` plus
`DOOEY_PASSWORD` set in `.env.local` (the account the user signs into DOOEY with).

The SCHEDULE.md shape matters, because the app parses it. See the skill's
`references/file-formats.md`: `## ` headers become tracks, `- [ ] <Label> — <YYYY-MM-DD> — <Topic>`
is one session, and `⛳` or `GATE` marks a gate.

## Where sessions become tasks (read this before relying on it)

A program's work is meant to be ordinary tasks: a `tasks` record per SCHEDULE.md session, with a
`project` field pointing at the program plus `gate` and `session_key`. Once materialized they show
up in Planner, are timeboxable, and open the standard task page. The `materialized` flag guards the
one-time conversion so a re-sync never duplicates, and deleting a program cascade-deletes its tasks.

**That conversion runs in the legacy web app only** (`src/features/learning/api.ts`, backed by
`pb/pb_migrations/019_program_materialized.js`). The Expo app's
`mobile/src/features/learning/api.ts` only *reads* `learning_programs`, so pushing a program while
just the mobile app is running creates the program record but no tasks. Run the web app once, or
port the materialization, before treating push as end to end.
