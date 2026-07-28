/// <reference path="../pb_data/types.d.ts" />

// Rituals — the standing commitments the Planner lays out: which routine you
// train on which weekdays, when you mean to log a meal. Only the *schedule*
// lives here; whether a given day's slot was kept is derived from the workouts
// and journal entries themselves, so there is nothing to keep in sync.
//
// A field on `users` rather than a collection of its own: this is a handful of
// rows the client always reads whole, and it belongs to the account the same
// way the shell arrangement does.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "rituals" }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("rituals");
    app.save(users);
  },
);
