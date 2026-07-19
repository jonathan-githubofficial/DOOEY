/// <reference path="../pb_data/types.d.ts" />

// Free-form mood boards: one record per board holding placed items (notes,
// stickers, links, photos, and group zones), a freehand doodle layer, and the
// photo files themselves.

migrate(
  (app) => {
    const boards = new Collection({
      type: "base",
      name: "moodboards",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text", name: "title", required: true, max: 80 },
        { type: "json", name: "items" }, // [{ id, kind, x, y, w?, h?, rot?, ... }]
        { type: "json", name: "doodle" }, // [{ color, points: [[x,y]…] }] in px of the board
        { type: "file", name: "photos", maxSelect: 60, maxSize: 20971520 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_moodboards_owner ON moodboards (owner)"],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(boards);
  },

  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId("moodboards"));
    } catch (_) {}
  },
);
