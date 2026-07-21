/// <reference path="../pb_data/types.d.ts" />

// The wordmark's doodled animation frames — drawn in the wordmark studio,
// played on the login page. Stored on the user record (like the companion)
// so the front door greets the user on every device.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "logo_doodle" })); // { frames: Stroke[][], interval: ms }
    app.save(users);
  },

  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("logo_doodle");
    app.save(users);
  },
);
