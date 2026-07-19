/// <reference path="../pb_data/types.d.ts" />

// A task page can host a free-form mood board instead of the old scrapbook
// layer — store the linked board's id on the task.

migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.add(new TextField({ name: "board" })); // moodboards record id, or ""
    app.save(tasks);
  },

  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeByName("board");
    app.save(tasks);
  },
);
