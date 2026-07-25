/// <reference path="../pb_data/types.d.ts" />

// A session can be paused: `paused_at` is when the current pause began (empty
// while running) and `paused_ms` is the time banked by pauses already ended.
// The clock reads (paused_at ?? now) - started_at - paused_ms, so a break for
// a phone call doesn't get logged as training. Storing it here rather than on
// the device means a pause survives a reload and follows you to the web app.

migrate(
  (app) => {
    const workouts = app.findCollectionByNameOrId("workouts");
    workouts.fields.add(new DateField({ name: "paused_at" }));
    workouts.fields.add(new NumberField({ name: "paused_ms" }));
    app.save(workouts);
  },

  (app) => {
    const workouts = app.findCollectionByNameOrId("workouts");
    workouts.fields.removeByName("paused_at");
    workouts.fields.removeByName("paused_ms");
    app.save(workouts);
  },
);
