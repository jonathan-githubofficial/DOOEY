/// <reference path="../pb_data/types.d.ts" />

// PocketBase 0.23+ does not add `created`/`updated` automatically — they're plain
// autodate fields you have to declare. Without them the app's
// getFullList({ sort: "-created" }) 400s and every program silently fails to load.

migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    programs.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
    app.save(programs);
  },

  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.removeByName("created");
    programs.fields.removeByName("updated");
    app.save(programs);
  },
);
