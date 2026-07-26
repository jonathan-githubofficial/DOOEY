/// <reference path="../pb_data/types.d.ts" />

// R1 product reset (2026-07-16). The SaaS-era schema — tasks with energy/score/
// visibility, habits, goals, preferences — was never wired to any UI. Replace it
// with the tasks-as-pages model: a task carries its whole page (notes, checklist,
// resources, attachments) as one record. calendar_links / calendar_events stay —
// R5 (Google Calendar sync) builds on them.

migrate(
  (app) => {
    // habit_logs cascades from habits, so it goes first.
    for (const name of ["preferences", "habit_logs", "habits", "goals", "tasks"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    }

    const tasks = new Collection({
      type: "base",
      name: "tasks",
      fields: [
        { type: "relation", name: "owner",    required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text",     name: "title",    required: true },
        { type: "date",     name: "due_date" },   // date-only semantics, stored at 00:00Z
        { type: "date",     name: "done_at" },
        { type: "text",     name: "notes" },
        { type: "json",     name: "checklist" },  // [{ id, label, done }]
        { type: "json",     name: "resources" },  // [{ id, url, label, kind: "link" | "youtube" }]
        { type: "file",     name: "attachments", maxSelect: 12, maxSize: 20971520 },
        { type: "autodate", name: "created",  onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated",  onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_tasks_owner_done ON tasks (owner, done_at)"],
      listRule:   "@request.auth.id != '' && owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(tasks);
  },

  (app) => {
    try { app.delete(app.findCollectionByNameOrId("tasks")); } catch (_) {}
  },
);
