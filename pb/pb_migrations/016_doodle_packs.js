/// <reference path="../pb_data/types.d.ts" />

// Doodle packs: named collections of saved freehand drawings on a user's
// account, placeable onto any board. Owner-scoped like everything else, so
// sharing packs with other users later is a rules change, not a remodel.

migrate(
  (app) => {
    const packs = new Collection({
      type: "base",
      name: "doodle_packs",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: true },
        { type: "text", name: "title", required: true, max: 60 },
        { type: "json", name: "doodles" }, // [{ id, name, strokes: [{color, points}], aspect }]
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_doodle_packs_owner ON doodle_packs (owner)"],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(packs);
  },

  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("doodle_packs"));
    } catch (_) {}
  },
);
