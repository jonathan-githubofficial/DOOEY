/// <reference path="../pb_data/types.d.ts" />

// Scrapbook layer for the planner: one record per (owner, day) holding freehand
// doodle strokes, placed items (stickers / photos as polaroids or stamps), and
// the photo files themselves.

migrate(
  (app) => {
    const pages = new Collection({
      type: "base",
      name: "planner_pages",
      fields: [
        { type: "relation", name: "owner",  required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text",     name: "date",   required: true }, // YYYY-MM-DD (local day key)
        { type: "json",     name: "doodle" },  // [{ color, points: [[x,y]…] }] in % of sheet
        { type: "json",     name: "items" },   // [{ id, kind, emoji?, file?, x, y, rot, style? }]
        { type: "file",     name: "photos", maxSelect: 30, maxSize: 20971520 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_planner_pages_owner_date ON planner_pages (owner, date)",
      ],
      listRule:   "@request.auth.id != '' && owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(pages);
  },

  (app) => {
    try { app.delete(app.findCollectionByNameOrId("planner_pages")); } catch (_) {}
  },
);
