# DOOEY — Project Guide for Claude

DOOEY is a **personal life OS**: your tasks for the day, recurring habits, a food journal, and
learning programs — in one tactile, playful app that syncs two-way with Google Calendar.

It is built **for one user (the owner) now**, but every record keeps multi-user data isolation
(`owner` fields + PocketBase rules) so opening it up as a SaaS later is a config change, not a
rewrite. No sharing/visibility UI until then.

This file is the canonical entry point. Deeper docs live in [docs/](docs/).

---

## The three spaces

The app is three spaces behind a persistent **bottom dock** — one tap to anywhere, identical on
phone and desktop:

1. **Today** — everything I have to do today in one glance: one-shot tasks, recurring-habit
   progress, and my Google Calendar events for the day, interleaved.
2. **Learning** — my programs as file-folder cards, plus a guided "new program" flow where
   Claude generates a full schedule in-app (learning-architect methodology).
3. **Journal** — free-text food log for today.

**Tasks are pages, not rows.** Every task opens into its own self-contained page with fixed,
well-designed sections: notes, checklist, resources (links + video embeds), attachments.
Notion-ish depth, but structured — no free-form block editor.

See [docs/roadmap.md](docs/roadmap.md) for delivery order and acceptance criteria.

---

## Creating a learning program from this session

When you build a program with the **learning-architect** skill in this repo, don't hand the
user files to import by hand — **verify it, then push it straight into DOOEY's database**:

```bash
npm run verify-program -- <dir>   # checks the bundle against the app's real parser
npm run push-program   -- <dir>   # verifies again, then writes it to PocketBase
```

`verify-program` imports the app's own `parse.ts`, so whatever passes is exactly what the UI
renders. It checks the ≤5-word title, the `Why:` line, ISO dates, gate markers + matching tests,
and that `calendar.ics` agrees with `SCHEDULE.md`. **push-program refuses to push on any error** —
never bypass it; fix the bundle.

That reads `PLAN.md` / `SCHEDULE.md` / `TESTS.md` / `DAILY-TEMPLATE.md` / `LOG.md` /
`calendar.ics` from the directory, derives the goal from PLAN.md's `# Program:` heading, and
creates a `learning_programs` record. The running app picks it up **live** (PocketBase
realtime) and **materializes each SCHEDULE.md session into a real task** — a normal `tasks`
record with a `project` field pointing at the program (plus `gate` + `session_key`). From then
on a project's work is just tasks: they appear in Today/Calendar, are time-boxable like any
task, and open the standard task page. The program record keeps the goal/why, the folder
styling, and the source files as reference; `materialized` guards the one-time conversion so a
re-sync never duplicates. Deleting a program cascade-deletes its tasks. The old per-session
tick/progress model (SCHEDULE-derived sessions, `/session/...` pages) is gone.

Prerequisites: PocketBase running (`pb/pocketbase.exe serve`), and `DOOEY_EMAIL` /
`DOOEY_PASSWORD` set in `.env.local` (the account the user signs into DOOEY with).

The SCHEDULE.md shape matters — the app parses it. See the skill's `references/file-formats.md`:
`## ` headers → tracks, `- [ ] <Label> — <YYYY-MM-DD> — <Topic>` per session, `⛳`/`GATE` marks a gate.

---

## Philosophy

- **Feature by feature.** One feature lands fully before the next starts. No half-finished stubs, no "coming soon" pages, no scaffolding for hypothetical phases.
- **Simple first, smart later.** Ship the dumb version that works. Add intelligence (smart suggestions, ranking, LLM augmentation) only after the basics earn it.
- **Personal now, SaaS-ready.** One real user, but data isolation (`owner` + server rules) is never skipped — future multi-user must not require a rewrite.
- **Getting around is effortless.** Three spaces, one dock, one tap. Depth (task pages, program detail) is drill-in + back, never a maze.

---

## Current scope (locked feature list)

1. **Navigation shell** — the bottom dock + three spaces, in the tactile design language.
2. **Tasks (Today space)** — persisted one-shot tasks, quick-add with minimum friction.
3. **Task pages** — every task opens to structured sections: notes, checklist, resources (links, video embeds), attachments.
4. **Recurring habits** — "gym 2–4×/week": weekly target + progress, shown in Today.
5. **Food journal (Journal space)** — free-text log of what I ate today.
6. **Google Calendar two-way sync** — dated tasks and learning sessions appear in Google Calendar; calendar events appear in Today.
7. **Learning generation in-app** — describe a goal on the Learning page, Claude generates the program right there (local Claude Code bridge first, API-key path later behind the same seam). Import/push stays as the power-user path.

Out of scope until explicitly added: sharing/visibility UI, friends/social graph, smart suggestions, notifications, billing, mobile-native, offline.

---

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Build | Vite + React 19 + TypeScript |
| Routing | TanStack Router — one route per space + task/program detail |
| Client state | Zustand v5 — one store per domain |
| Server state | TanStack Query v5 + PocketBase SDK |
| Realtime | PocketBase SSE subscriptions |
| Animation | `motion/react` |
| UI primitives | **shadcn/ui** — default for all base components |
| Icons | `lucide-react` + custom SVGs in `src/components/icons` |
| Styling | Tailwind v4 (`@import "tailwindcss"`) + `tw-animate-css` |
| Fonts | Outfit (body) + Fraunces (display) — both via `@fontsource-variable/*` |
| Backend | PocketBase (Go binary) on a VPS |
| Auth | PocketBase email + Google OAuth |

**Do not add** without asking: i18n, system theme, a third font, Redux/Jotai/SWR, a second data-fetching lib, native mobile, react-grid-layout, feature-flag service, a block-editor library.

---

## UI components — shadcn/ui first

Before building a custom component, check if shadcn has it. Run `npx shadcn@latest add <component>` rather than installing raw Radix packages.

- Generated shadcn components go in `src/components/ui/`.
- Extend with Tailwind classes, not by forking the generated file.
- One-off components live in `src/features/<feature>/components/` or `src/components/` if genuinely shared.
- Shared tactile primitives (`Panel`, `Eyebrow`) live in `src/components/surface.tsx`.

---

## Design aesthetic — "tactile objects"

Clean skeuomorphism: real-world metaphors where they earn their keep, calm surfaces everywhere
else. Simple yet breathtaking; fun and playful, never silly. Depth comes from **soft light**,
not bevels or gloss.

**Objects:** tasks are paper cards; learning programs are file folders (see `CategoryCard`);
toggles and checks feel spring-loaded. A metaphor must clarify what a thing *is* or *does* —
decoration alone doesn't justify one.

**Surfaces:** soft rounded panels (`--radius-card`), two-layer `.shadow-soft` shadows
(light/dark variants), a faint feTurbulence paper grain on `body` (2–3% opacity). Sections are
panels, not hairline-divided columns.

**Type:**
- Display = **Fraunces Variable** (bold/black, tight tracking) — wordmark, space titles, big numbers.
- Body = **Outfit Variable** — UI text, lists, inputs.
- Eyebrows: uppercase, tracked `0.18em`+, 10px, `text-ink-muted`.

**Palette (CSS tokens in `src/styles/global.css`):**
- `--paper` / `--ink` / `--ink-muted` / `--rule` — warm neutrals; light default, dark inverts paper↔ink.
- Accents: `--leaf` (green, done/positive) · `--zest` (orange, highlights/progress/wordmark dot) · `--sky` (blue) · `--clay` (red) · `--honey` (amber) — the last three mainly as category hues.

**Motion & micro-interactions** (every feature ships with its own — they're scope, not polish):
- Things **settle, they don't snap**: springs via `motion/react`, small overshoot, no linear easing.
- Press states depress (scale/shadow), completions celebrate small (a tick draw-on, a color wash — never confetti walls).
- Duration discipline: interactions ≤ 200ms perceived; page transitions ≤ 350ms.
- Everything animated must also work reduced-motion.

---

## Repository layout

```
DOOEY/
├── CLAUDE.md                ← you are here
├── docs/
│   ├── architecture.md      ← data model, sync, realtime
│   └── roadmap.md           ← feature-by-feature delivery plan
├── src/                     ← Vite app
└── pb/                      ← PocketBase binary + pb_hooks + pb_migrations
```

**Source folder layout** (folders created when a feature needs them — don't pre-create empties):

```
src/
  components/
    ui/                ← shadcn primitives
    icons/ornaments/   ← decorative SVGs
    surface.tsx        ← Panel, Eyebrow (shared tactile primitives)
  features/
    <feature>/         ← one folder per delivered feature (tasks, learning, journal, calendar, auth)
      components/      ← feature-specific UI
      api.ts           ← PB queries/mutations for this feature
      types.ts         ← feature-local types
      index.ts         ← public surface
  lib/                 ← pb, cn, format (shared utilities only)
  stores/              ← auth, theme (Zustand)
  pages/               ← one file per space + detail pages
  styles/              ← global.css
  main.tsx
  router.tsx
```

A feature's code lives entirely inside `src/features/<feature>/`. If something is reached for by two features, it moves to `src/lib/` or `src/components/`.

---

## Code quality rules

**No dead code.**
- Delete unused imports, variables, and functions immediately.
- Don't comment-out code. Git remembers.
- No `TODO`/`FIXME` in committed code — fix it or open an issue.
- No placeholder functions or "coming soon" blocks.

**Fix the root cause.** When something breaks, find the actual cause. Don't add a guard for an impossible case, don't swallow errors, don't paper over.

**Trust the boundaries.** Validate at user input and external API edges only. Don't defensively re-check things internal code already guarantees.

**Comments only when the *why* is non-obvious.** Code explains *what*; comments explain *why this surprising thing*.

---

## Conventions

- **One store per domain** in `src/stores/` (`auth`, `theme`, …) — except feature-isolated stores, which live in their feature folder (e.g. `features/learning/store.ts`).
- **Timestamps** are stored UTC in PocketBase, rendered in the user's timezone via `formatLocal(iso, user.timezone)`.
- **Data isolation** is enforced server-side via PocketBase rules (`owner = @request.auth.id`). The client trusts what PB returns.
- **Theme** is light + dark only. No system. Light is the default.
- **TypeScript strict.** Narrow types; `any` is a code smell, not a tool.

---

## What to read next

1. [docs/roadmap.md](docs/roadmap.md) — feature list with acceptance criteria + order
2. [docs/architecture.md](docs/architecture.md) — data model, calendar sync, realtime
