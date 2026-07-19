/// <reference path="../pb_data/types.d.ts" />

// The hand-drawn page icons (Calendar / Boards / Learning / Account) belong to
// the account, not the browser — store them on the user record so they follow
// the user across devices, like avatar_doodle already does.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "page_doodles" })); // { [page]: Stroke[] }
    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("page_doodles");
    app.save(users);
  },
);
