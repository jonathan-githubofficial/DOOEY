# Architecture

The minimum DOOEY needs to support the feature list. Anything not justified by [docs/roadmap.md](roadmap.md) doesn't exist yet.

## Stack diagram

```
┌─ Browser (responsive; dock + 3 spaces) ─────────┐
│  React 19 + Vite                                │
│  TanStack Router · TanStack Query · Zustand     │
│  shadcn/ui · Tailwind v4 · motion/react         │
└──────────────┬──────────────────────────────────┘
               │  HTTPS + SSE
┌──────────────┴──────────────────────────────────┐
│  PocketBase (Go binary, single process)         │
│   • SQLite                                      │
│   • Collections, rules, auth                    │
│   • OAuth: Google (R5 — calendar scope too)     │
│   • pb_hooks/  (JS — server hooks, gcal sync)   │
│   • pb_migrations/                              │
└──────────────┬──────────────────────────────────┘
               │  (R5) REST + webhook/poll
        Google Calendar API

(R6, dev machine only) local Claude Code bridge ← Learning "new program" flow
```

## Routes

| Route | Space |
|---|---|
| `/` | Today — tasks + habits + (R5) calendar events |
| `/task/$id` | Task page — structured sections |
| `/learning` | Learning — program folders, TodayList, (R6) new-program flow |
| `/learning/$id` | Program detail (currently local state; becomes a route with R1) |
| `/journal` | Journal (appears in R4) |

## Data model

Only collections required by R1–R6. Add fields when a feature needs them; don't pre-add.

### `users` (PocketBase built-in auth collection)

| Field | Type | Notes |
|---|---|---|
| `email` | string | built-in |
| `display_name` | string | |
| `timezone` | string | IANA, e.g. `Europe/Berlin`. Used for "today" and week boundaries. |

### `tasks` (R1–R3)

| Field | Type | Notes |
|---|---|---|
| `owner` | relation → users | required |
| `title` | string | required |
| `due_date` | date | nullable — dated tasks sync to Google Calendar (R5) |
| `done_at` | datetime | nullable — set when a one-shot task is completed |
| `cadence` | enum | `null \| weekly` — null for one-shots |
| `target_count` | int | weekly target when `cadence = weekly` (e.g. 3) |
| `notes` | text | task-page Notes section (R2) |
| `checklist` | json | R2 — `[{ id, label, done }]` |
| `resources` | json | R2 — `[{ id, url, title, kind: "link" \| "youtube" }]` |
| `attachments` | file[] | R2 |
| `created` | datetime | built-in |

Checklist and resources are JSON on the task, not child collections: a task page is loaded and
saved as one unit, one realtime event updates the whole page, and nothing queries checklist
items across tasks. Split them out only if a feature ever needs cross-task queries.

A task is either one-shot (`cadence = null`, uses `done_at`) or recurring (`cadence = weekly`,
ignores `done_at`, counts `task_completions`).

### `task_completions` (R3)

Separate from `tasks` so recurring tasks can be completed many times.

| Field | Type | Notes |
|---|---|---|
| `task` | relation → tasks | required |
| `owner` | relation → users | denormalized for rules |
| `completed_at` | datetime | required, UTC |

### `journal_entries` (R4)

| Field | Type | Notes |
|---|---|---|
| `owner` | relation → users | required |
| `kind` | enum | `food` (only kind for now) |
| `body` | text | required |
| `eaten_at` | datetime | required, UTC |

### `learning_programs` (delivered)

One record per imported/generated program: the six-file bundle (`PLAN.md`, `SCHEDULE.md`,
`TESTS.md`, `DAILY-TEMPLATE.md`, `LOG.md`, `calendar.ics`), the derived goal, and per-session
progress. Parsed client-side by `src/features/learning/parse.ts` — that parser is the contract
(`verify-program` runs it too).

### Calendar sync (R5 — shape finalized when built)

- Google OAuth tokens (calendar scope) stored server-side, never shipped to the client.
- A `gcal_links` collection maps DOOEY items ↔ Google event ids (`owner`, `task`/`session ref`, `gcal_event_id`, `etag`, `synced_at`) so pushes are idempotent and moves reconcile.
- Sync runs in `pb_hooks` (record hooks push; a cron pulls). DOOEY is source of truth for its own items; Google is source of truth for foreign events, which render read-only in Today.

## Data isolation (personal now, SaaS later)

There is one real user today, but **every collection keeps an `owner` field and server-side
PocketBase rules** (`owner = @request.auth.id` on list/view/create/update/delete). The client
trusts what PB returns. This is what makes the eventual SaaS switch a rules/UI change instead
of a rewrite. Sharing/visibility (`shared`/`public`) is out of scope — no `visibility` field
until the feature exists.

## Timezones and "today"

- All timestamps stored as UTC.
- "Today" is computed in the user's `timezone` field.
- The ISO week (Mon–Sun) used for recurring-task targets is computed in the user's timezone.
- Rendered times use `src/lib/format.ts` → `formatLocal(iso, user.timezone)`.

## Realtime

PocketBase SSE subscriptions update the TanStack Query cache. Pattern:

1. Component mounts → `useQuery(['tasks'])` fetches initial list.
2. Same component subscribes to `pb.collection('tasks').subscribe('*', …)`.
3. SSE event patches the query cache via `queryClient.setQueryData`.
4. Component unmounts → unsubscribe.

Don't poll. Don't refetch on focus when SSE is subscribed.

## Learning generation transport (R6)

The "new program" flow talks to a `generateProgram(goal, answers) → bundle` seam. First
implementation: the local Claude Code bridge (HTTP to a dev-machine process that runs the
learning-architect skill, prompt via stdin). An Anthropic-API implementation can replace it
behind the same seam. Generated bundles pass the same validation as `verify-program` before a
`learning_programs` record is created; the UI must have an explicit offline/error state.

## Frontend conventions

- **State boundary:** Zustand owns *client* state (theme, auth, ephemeral UI). TanStack Query owns *server* state (tasks, journal). Don't mix. (Exception already shipped: `features/learning/store.ts` is Zustand+localStorage as offline source of truth, synced to PB on sign-in.)
- **Feature isolation:** `src/features/<feature>/` is self-contained. Cross-feature imports go through `lib/` or `components/`, not directly into another feature.
- **Routing:** one route per space + detail routes (`/task/$id`, `/learning/$id`). The dock is layout chrome, rendered once.
