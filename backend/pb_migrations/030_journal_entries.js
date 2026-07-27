/// <reference path="../pb_data/types.d.ts" />

// The Journal: what you ate, as free text. `kind` is a discriminator so the
// same collection can hold other sorts of entry later without a second table;
// today only "food" is written. `eaten_at` is when it happened rather than when
// it was typed, so a late entry still lands on the right day.

migrate(
  (app) => {
    const entries = new Collection({
      type: "base",
      name: "journal_entries",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text", name: "kind", required: true, max: 20 },
        { type: "text", name: "body", required: true, max: 2000 },
        { type: "date", name: "eaten_at", required: true },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      // The only query the app makes is "my entries for this day, in order".
      indexes: ["CREATE INDEX idx_journal_owner_eaten ON journal_entries (owner, eaten_at)"],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(entries);
  },

  (app) => {
    app.delete(app.findCollectionByNameOrId("journal_entries"));
  },
);
