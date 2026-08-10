/// <reference path="../pb_data/types.d.ts" />

// A picture of a session.
//
// The numbers a workout leaves behind — volume, duration, which muscles — say
// what you did but nothing about what it was like. One photo taken when you
// finish does, and it is the only part of a session anybody ever wants to look
// at again a year later. Stored on the workout rather than as an entry against
// a tracker: it belongs to that session, and deleting the session should take
// it with it.
//
// One file, not many. A gym photo is a moment, and asking "which of these six"
// is a worse question than "here it is".

migrate(
  (app) => {
    const workouts = app.findCollectionByNameOrId("workouts");
    workouts.fields.add(
      new FileField({
        name: "photo",
        maxSelect: 1,
        maxSize: 12 * 1024 * 1024,
        mimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"],
        thumbs: ["320x320", "900x0"],
      }),
    );
    app.save(workouts);
  },
  (app) => {
    const workouts = app.findCollectionByNameOrId("workouts");
    workouts.fields.removeByName("photo");
    app.save(workouts);
  },
);
