/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // ── habits ─────────────────────────────────────────────────────────────
    const habits = new Collection({
      type: "base",
      name: "habits",
      fields: [
        { type: "relation", name: "owner",          required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text",     name: "title",          required: true },
        { type: "select",   name: "cadence",        values: ["daily","weekly","custom"], required: true },
        { type: "json",     name: "cadence_config" },
        { type: "text",     name: "window_start" },
        { type: "text",     name: "window_end" },
        { type: "number",   name: "target_count",   min: 1 },
        { type: "number",   name: "streak_current", min: 0 },
        { type: "number",   name: "streak_best",    min: 0 },
        { type: "date",     name: "last_done_at" },
        { type: "select",   name: "visibility",     values: ["public","circles","private","hidden_placeholder"], required: true },
      ],
      listRule:   "@request.auth.id != '' && owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(habits);

    // ── habit_logs ─────────────────────────────────────────────────────────
    const habitLogs = new Collection({
      type: "base",
      name: "habit_logs",
      fields: [
        { type: "relation", name: "habit",          required: true, collectionId: habits.id, cascadeDelete: true },
        { type: "date",     name: "completed_at",   required: true },
        { type: "text",     name: "skipped_reason" },
      ],
      listRule:   "@request.auth.id != '' && habit.owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && habit.owner = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && habit.owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && habit.owner = @request.auth.id",
    });
    app.save(habitLogs);

    // ── goals ──────────────────────────────────────────────────────────────
    const goals = new Collection({
      type: "base",
      name: "goals",
      fields: [
        { type: "relation", name: "owner",       required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text",     name: "title",       required: true },
        { type: "text",     name: "why" },
        { type: "date",     name: "target_date" },
        { type: "number",   name: "progress",    min: 0, max: 1 },
        { type: "select",   name: "visibility",  values: ["public","circles","private","hidden_placeholder"], required: true },
      ],
      listRule:   "@request.auth.id != '' && owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(goals);
    // Self-relation: add after save, once the collection has an id to point at.
    goals.fields.add(new RelationField({ name: "parent", collectionId: goals.id, cascadeDelete: false }));
    app.save(goals);

    // ── calendar_links ─────────────────────────────────────────────────────
    const calendarLinks = new Collection({
      type: "base",
      name: "calendar_links",
      fields: [
        { type: "relation", name: "user",                     required: true, collectionId: "_pb_users_auth_", cascadeDelete: true, unique: true },
        { type: "select",   name: "provider",                 values: ["google"], required: true },
        { type: "text",     name: "refresh_token_encrypted",  required: true },
        { type: "text",     name: "calendar_id" },
        { type: "date",     name: "last_sync_at" },
      ],
      listRule:   "@request.auth.id != '' && user = @request.auth.id",
      viewRule:   "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
    });
    app.save(calendarLinks);

    // ── calendar_events ────────────────────────────────────────────────────
    const calendarEvents = new Collection({
      type: "base",
      name: "calendar_events",
      fields: [
        { type: "relation", name: "user",        required: true, collectionId: "_pb_users_auth_", cascadeDelete: true },
        { type: "text",     name: "external_id", required: true },
        { type: "text",     name: "title" },
        { type: "date",     name: "start_at",    required: true },
        { type: "date",     name: "end_at",      required: true },
        { type: "text",     name: "calendar_id" },
      ],
      indexes: [
        "CREATE INDEX idx_cal_events_user_start ON calendar_events (user, start_at)",
        "CREATE UNIQUE INDEX idx_cal_events_external ON calendar_events (user, external_id)",
      ],
      listRule:   "@request.auth.id != '' && user = @request.auth.id",
      viewRule:   "@request.auth.id != '' && user = @request.auth.id",
      createRule: null,  // server-only via hook
      updateRule: null,
      deleteRule: null,
    });
    app.save(calendarEvents);
  },

  (app) => {
    for (const name of ["calendar_events","calendar_links","goals","habit_logs","habits"]) {
      try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
    }
  },
);
