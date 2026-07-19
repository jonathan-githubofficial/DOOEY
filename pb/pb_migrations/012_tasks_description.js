/// <reference path="../pb_data/types.d.ts" />

// A one-line description under the title — set when the task is created,
// shown in every agenda row (same shape learning sessions already have).

migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.add(new TextField({ name: "description" }));
    app.save(tasks);
  },

  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeByName("description");
    app.save(tasks);
  },
);
