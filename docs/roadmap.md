# Roadmap

One feature at a time. Each ships fully — UI, data, micro-interactions, polish — before the next starts. Order is fixed; scope can be cut but not expanded mid-feature.

> **Reset (2026-07-16).** The original task-SaaS roadmap (F0–F5) drifted: the learning feature was built instead and took over the home page. This roadmap replaces it, per the product interview: personal-first, three spaces behind a dock, tasks-as-pages, two-way Google Calendar, in-app learning generation. History below under "Delivered".

## How to read this

Every feature has:
- **Why** — the user need it serves.
- **Scope** — what's in.
- **Out of scope** — what's tempting but deferred.
- **Acceptance** — observable behavior that proves it's done.

When a feature is delivered, mark it ✅ here and move the next one to in-progress.

---

## ✅ Delivered so far

- **Identity + tokens** *(2026-05-22, revised 2026-07-13)* — DOOEY wordmark (Fraunces, zest full-stop), paper/ink/leaf/zest tokens later extended with sky/clay/honey, light default + dark inversion. Original art-magazine styling superseded by the **tactile-objects** system: `Panel`/`Eyebrow` in `src/components/surface.tsx`, `.shadow-soft`, paper grain, folder-style cards.
- **Learning command center** *(2026-07-13)* — `src/features/learning/`: import a learning-architect bundle (or `npm run push-program`), programs render as file-folder `CategoryCard`s with a cross-program `TodayList`, drill-in detail view (`ProgramHeader`, `Runway`, `ScheduleList`, `Materials`), progress ticks sync to PocketBase (`learning_programs`, realtime).
- **Auth (email + password)** *(2026-07-13)* — `src/features/auth/`, `AccountButton` in the masthead, PB users; signing in syncs local programs with PB. Google OAuth not wired yet (lands with R5, which needs Google tokens anyway).

---

## ✅ R1 — Navigation shell + tasks

*Delivered 2026-07-16.* Dock (`src/components/dock.tsx`) with Today + Learning behind real routes; masthead extracted to `src/components/masthead.tsx`; `src/features/tasks/` with migration 006 (legacy SaaS-era collections dropped, lean `tasks` schema), quick-add, spring check-off, overdue/today due chips, done-today section, optimistic mutations + SSE refresh. Verified end-to-end against a live PocketBase (filter semantics incl. timezone edge, owner isolation, realtime) plus desktop/phone screenshots.

**Why:** The app currently *is* the learning dashboard. Give it its skeleton — the dock and spaces — and bring back its primary identity: tasks I have to do today.

**Scope:**
- Persistent bottom dock in the tactile style; spaces: **Today** and **Learning** (Journal tab appears in R4 — no dead tabs).
- TanStack Router routes per space; Learning feature moves to `/learning` unchanged.
- PocketBase `tasks` collection (`owner`, `title`, `due_date` nullable, `done_at` nullable).
- Today space: today's tasks (`due_date = today OR null`), quick-add input (title only, Enter to add), spring-loaded check-off, delete.
- Dock + check-off micro-interactions (settle-not-snap, tick draw-on).

**Out of scope:** task pages (R2), habits (R3), calendar events in Today (R5), tags/priority/subtasks.

**Acceptance:** I open the app to Today, add "buy milk", refresh — it's there. I tap the dock to Learning and back; the transition is smooth on phone-width and desktop. Checking a task off feels physical and survives reload.

**Extended again — planner book + scrapbook (2026-07-16, revised same day).** The agenda became a top-bound pad (`PlannerBook`): three wire rings through punched holes (shared slot geometry guarantees alignment), pages that flip up over the binding (desk-calendar style, reduced-motion safe), and the static rest-of-pad peeking out below. The dock tab is now **Planner**. The scrapbook layer (freehand doodling with four inks + undo, emoji stickers, photos as polaroids or perforated stamps, all draggable) lives **on each task's page** — fields on the task record (`doodle`, `decor`, `decor_photos`, migration 009), not on the day sheet. Learning sessions are first-class planner rows: interleaved and drag-reorderable with tasks (order in `learning_programs.layout`), tickable, and each opens its own page (`/session/$programId/$key`) where label/topic edit back into SCHEDULE.md and notes persist in `layout`. The masthead wears a **doodled avatar** (`users.avatar_doodle`, drawn in-app — no photo uploads) left of the wordmark, with email + sign-out stacked vertically.

**Round 6 (2026-07-17).** Wordmark eyes reverted (plain DOOEY). Fixed the broken day navigation: round-5's `MeasuredPage` called `usePresence()` (manual-removal mode, never released) so exiting planner pages never unmounted and stacked up — now `useIsPresent`; verified with 7 scripted navigation assertions (chips, week paging, back-to-today, month cells, view toggles). Calendar view swap is one quick settle-in (accordion removed); pad height tweens (no spring bounce). Dock slimmed: icons only, the active space says its name. Declutter: row info cluster is hover-only, sheet header shows just the open count, add-section affordances are icon dots. The avatar doodle wears an old-timey double-ring portrait frame (line work only, no fill).

**Round 5 (2026-07-17).** The wordmark's OO are now **eyes** — pupils track the cursor on springs, lids blink on a lazy rhythm (reduced-motion: still). Account moved off the masthead into its own dock space (`/account`: sign-in/up form, doodled avatar, email, sign-out); the avatar is frameless and its strokes render in viewBox units so the doodle scales crisply instead of thickening (`DoodleSvg relative`). The week⇄month calendar swap is an accordion (fold/unfold, the pad glides), and `PlannerBook` measures the arriving page (ResizeObserver + usePresence) and springs the pad's height between different paper sizes — no more end-of-flip snap.

**Round 4 (2026-07-17).** Page-body components extracted to `src/components/page/` (`PageSections`, `Scrapbook`, `Check`, sections) — **task pages and session pages are now the same components**; session content lives in `learning_programs.layout` + a `session_files` file field (migration 010). Planner gained a **month view** (grid with zest task-dots + category session-dots, week⇄month toggle); the page flip got a longer 140° arc with tilt-shading and a spring settle on back-flips, and the pad's back pages are static (they're the part you're not flipping). Avatar is frameless and bigger.

**Extended same day — the day planner.** Today grew into a week-strip day planner (user request): a `WeekStrip` (Mon–Sun chips, week paging, springy selection, "back to today"), one `AgendaSheet` paper per day that page-flips between dates (direction-aware), drag-to-reorder rows (`sort_order` float, migration 007), an at-a-glance info cluster per row (notes/checklist/links/files), day-scoped quick-add (a task typed on Friday files itself under Friday), and the day's learning sessions embedded via `DaySessions` (self-syncing, ticks flow back to program progress). Future/past days are one tap away; today still gathers undated + overdue.

---

## ✅ R2 — Task pages

*Delivered 2026-07-16.* `/task/$id` route → `TaskDetail`: editable title, due-date chip with native picker, and the four structured sections (notes with debounced autosave, checklist, resources with YouTube embeds, attachments with image thumbnails). Empty sections hide behind dashed add-affordances. Attachment add/download/remove verified against PB.

**Why:** A task is more than a row. "Build a PC" carries research links, videos to watch, a parts checklist — all of it should live inside the task, self-contained.

**Scope:**
- Tapping a task opens its page (route `/task/$id`), sliding over the Today space with a back action.
- Fixed structured sections (not a block editor): **Notes** (plain text), **Checklist** (add/toggle/remove items), **Resources** (URLs with title + favicon; YouTube links render as embeds), **Attachments** (PB file field).
- Sections render only when non-empty; an "add section" affordance keeps empty pages clean.
- Page transition + section micro-interactions.

**Out of scope:** free-form blocks, markdown editing, comments, cross-task links, resource previews beyond YouTube.

**Acceptance:** I create "Build a PC", open its page, add notes, a 3-item checklist, and a YouTube link that plays embedded. Everything persists. Back returns to Today with my scroll position intact.

---

## R3 — Recurring habits (in progress next)

**Why:** "Gym 2–4×/week" needs to know about the week, not the day.

**Scope:**
- Recurring model on `tasks` (`cadence: weekly`, `target_count`) + `task_completions` collection.
- Today space shows habits with N/target progress (zest in progress, leaf at target); tapping logs a completion.
- Week resets Monday 00:00 in the user's timezone.
- Habits get task pages too (R2 sections apply).

**Out of scope:** monthly/custom intervals, streak history, reminders.

**Acceptance:** I create "Gym, 3×/week", tick it three times → leaf. Next Monday it resets. Mid-week the bar matches the completion count.

---

## R4 — Journal space

**Why:** Log what I ate today with zero friction — free text, parsed later (maybe).

**Scope:**
- Journal joins the dock (third space).
- PB `journal_entries` (`owner`, `kind: food`, `body`, `eaten_at`).
- Today's entries with timestamps; add (defaults `eaten_at` to now), edit, delete.

**Out of scope:** nutrition parsing, macros, photos, non-food kinds.

**Acceptance:** I type "two eggs and toast", it appears timestamped and survives reload. Yesterday's entries don't show.

---

## R5 — Google Calendar two-way sync

**Why:** The calendar is where my day actually lives. Dated tasks and learning sessions should appear there; calendar events should appear in Today.

**Scope:**
- Google OAuth (sign-in + calendar scope), tokens stored server-side.
- **Push:** tasks with a `due_date` and learning sessions create/update/delete Google Calendar events (via pb_hooks / server worker).
- **Pull:** today's Google events render in the Today space, interleaved with tasks by time.
- Completing a synced item in either place reconciles (DOOEY is source of truth for tasks; Google for foreign events).

**Out of scope:** multiple calendars, attendee handling, editing foreign events in DOOEY, historical import.

**Acceptance:** I date a task → it appears in Google Calendar within a minute. I move the event in Google → the task's date follows. My 14:00 meeting shows in Today between my morning and evening tasks.

---

## R6 — In-app learning generation

**Why:** Creating a program shouldn't require leaving the app. Describe a goal on the Learning page; Claude builds the program right there.

**Scope:**
- "New program" flow on the Learning space: goal input + the learning-architect clarifying questions.
- Generation via a **local Claude Code bridge** (resurrect the removed `server/claude-bridge.mjs` pattern, stdin prompt), behind a transport seam so an Anthropic-API path can replace it later.
- Result validated with the same checks as `verify-program` before saving; failures surface with a retry.
- Import/push remains as the power-user path.

**Out of scope:** the API-key transport (later), mid-program replanning UI, chat with the program.

**Acceptance:** With the bridge running, I type a goal, answer the questions, and a full program (schedule, gates, materials) appears as a folder on the Learning space — identical in shape to an imported bundle. With the bridge down, I get a clear "bridge offline" state, not a spinner.

---

## After R6 — candidate features (not committed)

- Turning learning sessions into first-class Today items (beyond calendar events).
- Sharing/visibility + the SaaS switch (rules already isolate per-owner).
- Streaks + history for habits.
- LLM journal parsing (nutrition).
- Web push notifications.
- PWA / installable.
