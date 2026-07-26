/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // ── tasks ──────────────────────────────────────────────────────────────
    const tasks = new Collection({
      type: "base",
      name: "tasks",
      fields: [
        { type: "relation", name: "owner",             required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text",     name: "title",             required: true },
        { type: "text",     name: "notes" },
        { type: "date",     name: "due_at" },
        { type: "number",   name: "est_minutes",       min: 0, max: 720 },
        { type: "select",   name: "energy",            values: ["low","medium","high"],                         required: true },
        { type: "json",     name: "tags" },
        { type: "select",   name: "status",            values: ["inbox","today","doing","done","skipped"],       required: true },
        { type: "text",     name: "calendar_event_id" },
        { type: "select",   name: "visibility",        values: ["public","circles","private","hidden_placeholder"], required: true },
        { type: "json",     name: "visible_to" },
        { type: "number",   name: "score",             min: -100, max: 100 },
        { type: "date",     name: "score_updated_at" },
      ],
      indexes: ["CREATE INDEX idx_tasks_owner_status ON tasks (owner, status)"],
      listRule:   "@request.auth.id != '' && owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(tasks);

    // ── preferences ────────────────────────────────────────────────────────
    const preferences = new Collection({
      type: "base",
      name: "preferences",
      fields: [
        { type: "relation", name: "user",                required: true, collectionId: "_pb_users_auth_", cascadeDelete: true, unique: true },
        { type: "json",     name: "layout_json" },
        { type: "select",   name: "island_nav_position", values: ["top","left"] },
        { type: "select",   name: "smart_engine_mode",   values: ["rules","llm"] },
      ],
      listRule:   "@request.auth.id != '' && user = @request.auth.id",
      viewRule:   "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    });
    app.save(preferences);
  },

  (app) => {
    for (const name of ["preferences", "tasks"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    }
  },
);
