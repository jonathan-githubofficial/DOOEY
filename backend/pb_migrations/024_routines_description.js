/// <reference path="../pb_data/types.d.ts" />

// A routine wears a one-line description on its card — what it's for.

migrate(
  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.add(new TextField({ name: "description", max: 160 }));
    app.save(routines);
  },

  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.removeByName("description");
    app.save(routines);
  },
);
