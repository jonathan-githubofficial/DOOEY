/// <reference path="../pb_data/types.d.ts" />

// The shell arrangement — dock order/visibility and the Home widget layout —
// lives on the user record so it follows the account across devices.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "shell" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("shell");
    app.save(users);
  },
);
