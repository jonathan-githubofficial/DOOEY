/// <reference path="../pb_data/types.d.ts" />

// What the app tracks stops being spelled out in code.
//
// A `tracker` is an aspect the user decided to keep: Food, Mood, Weight, Sleep.
// It is a record they create, so adding one is data entry rather than a code
// change. `shape` is the only thing the client switches on, and there are five:
//
//   text      words, nothing measured        "eggs and toast"
//   scale     a step between min and max     mood 4 of 5
//   amount    a number carrying a unit       78 kg
//   duration  minutes, shown as h:mm         7h 20m
//   tick      it happened, that is all       took the vitamins
//
// An `entry` is one moment of one tracker. Every shape may also carry `body`,
// because "78, felt bloated" is worth more than either half alone. `at` is when
// it happened rather than when it was typed, so a late entry still lands on the
// right day.
//
// This replaces `journal_entries`, which was this table with "food" hardcoded
// into it. Dropped here rather than migrated: the app has no users yet.

migrate(
  (app) => {
    const trackers = new Collection({
      type: "base",
      name: "trackers",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text", name: "name", required: true, max: 40 },
        // Stable across renames: what rituals point at and what the rambler
        // says out loud. The name is the label; this is the identity.
        { type: "text", name: "slug", required: true, max: 30 },
        { type: "text", name: "shape", required: true, max: 12 },
        // amount and duration only; "" for the rest.
        { type: "text", name: "unit", max: 12 },
        // scale only: the ends of the step run.
        { type: "number", name: "min" },
        { type: "number", name: "max" },
        // One of the palette's five card hues, so the Style studio repaints it.
        { type: "text", name: "hue", required: true, max: 10 },
        { type: "number", name: "position" },
        // Retired without losing its history — the delete rule is there for
        // when you really mean it, and takes the entries with it.
        { type: "bool", name: "archived" },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_trackers_owner_pos ON trackers (owner, position)",
        // One slug per person: the rambler resolves speech to a tracker by it,
        // so two Moods would make that ambiguous.
        "CREATE UNIQUE INDEX idx_trackers_owner_slug ON trackers (owner, slug)",
      ],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(trackers);

    const entries = new Collection({
      type: "base",
      name: "entries",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        // Deleting a tracker is the explicit "I never want this again"; archive
        // is how you stop tracking something and keep what you logged.
        { type: "relation", name: "tracker", required: true, collectionId: trackers.id, cascadeDelete: true },
        { type: "date", name: "at", required: true },
        { type: "text", name: "body", max: 2000 },
        { type: "number", name: "value" },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        // "my day, in order" — the Stamps page and the planner's slot join.
        "CREATE INDEX idx_entries_owner_at ON entries (owner, at)",
        // "this tracker over time" — a ritual asking whether its band was kept.
        "CREATE INDEX idx_entries_owner_tracker_at ON entries (owner, tracker, at)",
      ],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(entries);

    try {
      app.delete(app.findCollectionByNameOrId("journal_entries"));
    } catch (_) {}
  },

  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("entries"));
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId("trackers"));
    } catch (_) {}
  },
);
