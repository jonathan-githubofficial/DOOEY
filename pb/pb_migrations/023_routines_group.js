/// <reference path="../pb_data/types.d.ts" />

// Routines gather into plans — "Push", "Pull", "Legs" — the way Hevy folders
// routines. A plain text label, empty for loose routines.

migrate(
  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.add(new TextField({ name: "group", max: 40 }));
    app.save(routines);
  },

  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.removeByName("group");
    app.save(routines);
  },
);
