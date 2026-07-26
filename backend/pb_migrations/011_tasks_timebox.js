/// <reference path="../pb_data/types.d.ts" />

// Timeboxing: a task can be pinned to a slot in the day. start_min is minutes
// from local midnight (0 = unscheduled — the planner never schedules at 00:00),
// dur_min is the slot length in minutes (0 → client default of 60).

migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.add(new NumberField({ name: "start_min" }));
    tasks.fields.add(new NumberField({ name: "dur_min" }));
    app.save(tasks);
  },

  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeByName("start_min");
    tasks.fields.removeByName("dur_min");
    app.save(tasks);
  },
);
