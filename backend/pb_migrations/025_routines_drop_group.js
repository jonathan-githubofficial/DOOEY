/// <reference path="../pb_data/types.d.ts" />

// The plan/group on a routine is gone — grouping now lives in the program
// catalog (a program holds routines), not on the routine itself.

migrate(
  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.removeByName("group");
    app.save(routines);
  },

  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.add(new TextField({ name: "group", max: 40 }));
    app.save(routines);
  },
);
