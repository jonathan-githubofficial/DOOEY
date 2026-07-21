/// <reference path="../pb_data/types.d.ts" />

// The gym: routines are reusable workout templates (ordered exercises with
// set/rep/weight targets in JSON — no join tables, same shape as boards), and
// workouts are logged sessions — started from a routine or blank, entries
// filled in set by set, closed with ended_at.

migrate(
  (app) => {
    const routines = new Collection({
      type: "base",
      name: "routines",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text", name: "name", required: true, max: 80 },
        { type: "number", name: "position" },
        // [{ name, kind: "weight_reps"|"reps"|"duration", sets, target_reps, target_weight }]
        { type: "json", name: "items" },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_routines_owner ON routines (owner)"],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(routines);

    const workouts = new Collection({
      type: "base",
      name: "workouts",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text", name: "title", required: true, max: 80 },
        { type: "relation", name: "routine", collectionId: routines.id, cascadeDelete: false },
        { type: "date", name: "started_at", required: true },
        { type: "date", name: "ended_at" },
        // [{ name, kind, sets: [{ weight, reps, done }] }] — weights in the unit
        // the user logs with (a display preference, not a storage concern).
        { type: "json", name: "entries" },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_workouts_owner ON workouts (owner)"],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(workouts);
  },

  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("workouts"));
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId("routines"));
    } catch (_) {}
  },
);
