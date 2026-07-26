/// <reference path="../pb_data/types.d.ts" />

// The margin companion's animation frames belong to the account, not one
// device — store them on the user record (like page_doodles / avatar_doodle)
// so the little creature follows the user to phone and web alike.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "companion" })); // Stroke[][] — a pose per frame
    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("companion");
    app.save(users);
  },
);
