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

Prerequisites: PocketBase running (`backend/pocketbase.exe serve`), and `DOOEY_EMAIL` plus
`DOOEY_PASSWORD` set in `.env.local` (the account the user signs into DOOEY with).

The SCHEDULE.md shape matters, because the app parses it. See the skill's
`references/file-formats.md`: `## ` headers become tracks, `- [ ] <Label> — <YYYY-MM-DD> — <Topic>`
is one session, and `⛳` or `GATE` marks a gate.

## Where sessions become tasks (read this before relying on it)

A program's work is meant to be ordinary tasks: a `tasks` record per SCHEDULE.md session, with a
`project` field pointing at the program plus `gate` and `session_key`. Once materialized they show
up in Planner, are timeboxable, and open the standard task page. The `materialized` flag guards the
one-time conversion so a re-sync never duplicates, and deleting a program cascade-deletes its tasks.

The conversion runs in the app, in `materializeProgram`
(`frontend/src/features/learning/api.ts`, backed by `backend/pb_migrations/019_program_materialized.js`).
`useMaterializePrograms` fires it for any program whose `materialized` flag is still false, and it
is mounted on the Projects tab — so **pushing a program and then opening Projects is end to end**.

It is safe to run twice. The `materialized` flag is the outer guard, but the real protection is
per-session: every session already holding a task is skipped, matched on `session_key`. That key
comes from the position of the line in SCHEDULE.md, which is why the parser in
`frontend/src/features/learning/parse.ts` must keep its grouping rules exactly — a parser that
grouped differently would renumber every key and duplicate the lot.

`npm run verify-program` imports that same parser, so what the checker validates is what the app
will read.
