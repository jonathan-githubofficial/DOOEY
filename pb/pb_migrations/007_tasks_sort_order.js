/// <reference path="../pb_data/types.d.ts" />

// Manual ordering for the day agenda: drag-reorder persists a float sort key.
// Backfilled from creation time so existing tasks keep their order and every
// value is unique (midpoint inserts need strictly increasing neighbors).

migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.add(new NumberField({ name: "sort_order" }));
    app.save(tasks);

    for (const r of app.findAllRecords("tasks")) {
      r.set("sort_order", new Date(r.getString("created")).getTime());
      app.save(r);
    }
  },

  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeByName("sort_order");
    app.save(tasks);
  },
);
