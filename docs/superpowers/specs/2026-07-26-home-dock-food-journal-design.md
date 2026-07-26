# Home, a user-owned dock, and the Food Journal

Date: 2026-07-26. Status: approved in brainstorm, awaiting implementation plan.

## Why

DOOEY's spaces are silos you visit. Nothing shows the whole day at a glance, getting a thought
into the app takes too many taps, there is no way to find things across spaces, and the planned
food journal still doesn't exist. This spec adds the "daily glue": a Home space where actions
complete, a dock the user composes, and the Food Journal.

Guiding rule carried through every screen: **defaults are pre-filled guesses, never required
decisions.** And Home is where actions finish, not where journeys start.

## Decisions already made

- Home **absorbs** Planner's today view. Planner becomes the pure calendar space (week / month /
  agenda / timeboxing) and opens on Week.
- Home v1 runs on **DOOEY data only**. Google Calendar sync is a separate future project; the
  Schedule widget reserves a slot for it.
- Home is a **user-arranged widget stack**, not a fixed layout.
- Quick capture lands in an **Inbox** as untyped items; triage is optional and happens in place.
- Food Journal is **log + optional numbers**: no food database, manual kcal/protein, your own
  history becomes one-tap repeat chips.
- The dock is **user-configurable** from Account. No space is force-demoted; Projects ships in the
  dock by default and the user decides.

## 1. The frame: the dock belongs to the user

A "Your dock" editor in Account: every space (Planner, Boards, Projects, Gym, Food) can be
toggled in or out of the dock and reordered. Changes apply live while toggling — same feel as the
Style studio, no save button.

Guardrails (tasteful by construction):

- **Account is pinned.** The editor lives there; the user can never lock themselves out.
- **Home is pinned first.** It is the front door and where hidden spaces stay reachable.
- A hidden space is not deleted: its routes stay registered, it remains reachable from Home
  widgets, search results, and Account.

Mechanics:

- `frontend/src/lib/spaces.ts` (`SPACES`) gains `home` and `food` entries and stops being the
  literal dock order. Dock composition = pinned `home` + user's ordered visible spaces + pinned
  `account`, resolved through a hook (e.g. `useDock()`).
- Both tab bars consume the same resolved list: `NativeTabs` triggers on native,
  `Dock` on web. Hidden spaces render as tab screens with their trigger/stop omitted
  (routes stay alive for deep links).
- Routing: `(tabs)/index.tsx` becomes **Home**. Planner moves to `(tabs)/planner.tsx`.
  `spaceFor()` mappings update accordingly (task drill-ins keep lighting Planner's stop only where
  they open from Planner; the Home stop lights for Home-owned routes).
- Persistence: dock config (order + hidden set) lives with the user's other owned preferences,
  following the Style store pattern in `frontend/src/features/style/store.ts` (zustand + persist,
  synced per owner like style settings).
- Each new space gets a `doodle` key so hand-drawn dock icons keep working.

## 2. Home: a widget stack the user arranges

Home is a vertical scroll of blocks. An edit mode (entered from a header affordance) lets the user
reorder and hide widgets; the layout persists like a style preference. One shared block primitive
(`HomeWidget` shell: title eyebrow, surface card, edit-mode drag handle + hide control) is reused
by every widget and by Account's embedded widgets.

### Widgets — phase 1

- **Schedule (today)**: today's timeboxes and today's gym session on one vertical timeline, with a
  visual slot reserved for external calendar events (future sync project). Tapping a timebox opens
  its task; tapping the gym block opens the session.
- **Tasks today**: tasks due today plus overdue. Checkable **in place** — no navigation to
  complete. Overdue items auto-surface with an age marker ("3d"); rolling forward is the default
  state of the world, never a manual migration. Long-press a task → time picker → it lands on
  today's timeline (timeboxing without entering Planner).
- **Gym today**: the routine on deck with a one-tap start straight into the live logger.

### Widgets — phase 2

- **Capture bar**: a single text field. Submit on return; the field **stays focused** so
  rapid-fire capture is type-enter-type-enter. Creates `inbox_items`. If the clipboard holds a URL
  when the field focuses, show a one-tap paste chip.
  - **Share sheet target** (native): sharing a link/photo/text from any app creates an inbox item
    without foregrounding DOOEY.
  - **App quick action** (long-press icon → "Capture"): cold-starts into the capture field with
    the keyboard up.
- **Inbox**: captured items with a subtle age indicator. Triage in place: swipe right → task for
  today (default action, one gesture); swipe left → delete; tap → sheet for rarer moves (task with
  a date, board scrap, food entry). A URL suggests "board scrap" as its swipe default, plain text
  suggests "task". No forced triage ritual, no badge nagging.
- **Search**: a field that opens global search. Also reachable by **pull-down on Home**
  (Spotlight muscle memory), keyboard already up. Search-as-you-type across tasks, board items,
  learning programs, workouts, and food entries; results grouped by space; each result deep-links
  to the exact item (a board opens scrolled to the scrap).

### Widgets — phase 3

- **Food today**: today's meals with an add button, so routine logging never visits the Food tab.

### Planner slims down

Planner's index (today view) is retired in favour of Home; Planner keeps week / month / agenda /
timeboxing and opens on Week. No planner capability is deleted — only the today screen moves.

## 3. Food Journal: log + optional numbers

A new `food` space. A day per screen, swipe between days; history is just past days.

- Four meal slots: breakfast / lunch / dinner / snack. The slot is a **time-aware default**
  (log at 8am → Breakfast pre-selected) — override with one tap.
- An entry: text (required), optional photo, optional manual kcal and protein. Numbers never block
  saving. A camera button makes photo-first entries.
- **History becomes the database**: previously logged entries surface as one-tap repeat chips
  ("protein shake · 220 kcal") ranked by frequency/recency. By week two, regular meals are single
  taps with numbers attached.
- The day shows totals only when numbers exist; with no numbers it reads as a diary.

## Data

New PocketBase collections, both with `owner` fields and the standard per-owner rules
(multi-user isolation stays intact):

- `inbox_items`: owner, text, url?, image?, created. Promotion deletes the inbox item after
  creating the target record (task / board scrap / food entry).
- `food_entries`: owner, date, slot (breakfast|lunch|dinner|snack), text, photo?, kcal?, protein?.

Dock config and Home layout persist alongside the user's other owned preferences (Style store
pattern: zustand persist locally, synced per owner).

## Design system compliance

Everything renders through tokens: `usePalette()`, `useType()`, `useElevation()`,
`useCardRadius()`/`useShadow()`, and `frontend/src/lib/motion.ts`. No hex literals, no hand-written
`shadowColor`, no inline spring configs, no radius the Style slider cannot move. Swipe-to-triage
uses gesture springs from `motion.ts`; nothing bounces decoratively.

## Non-goals (this spec)

- Google Calendar sync or any external calendar read (slot reserved only).
- Notifications and reminders.
- A food database, macro targets, or nutrition charts.
- Sharing/visibility UI of any kind.
- Reworking Projects itself (it only becomes dock-optional).

## Build order

Three sub-projects, each its own plan → implementation cycle:

1. **Restructure + Home core**: SPACES/routing rework, user-configurable dock ("Your dock" in
   Account), widget-stack primitive + edit mode, Schedule / Tasks today / Gym today widgets,
   Planner slims to calendar.
2. **Capture + Inbox + Search**: capture bar, share sheet target, quick action, `inbox_items`,
   in-place triage, global search with pull-down entry.
3. **Food Journal**: `food_entries`, the day screen, repeat chips, Food-today widget on Home.
