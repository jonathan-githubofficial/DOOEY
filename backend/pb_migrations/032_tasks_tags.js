/// <reference path="../pb_data/types.d.ts" />

// Tags on tasks — a flat list of lowercase words, stored on the task rather
// than in a table of their own. There is no tag record to rename or delete:
// a tag exists exactly as long as some task carries it, which is the whole of
// what a personal tagging system needs.

migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.add(new JSONField({ name: "tags" }));
    app.save(tasks);
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeByName("tags");
    app.save(tasks);
  },
);
