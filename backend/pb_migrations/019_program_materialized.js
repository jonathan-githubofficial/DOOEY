/// <reference path="../pb_data/types.d.ts" />

// `materialized` flags that a program's SCHEDULE.md sessions have been turned
// into real tasks (project tasks). The app sets it once, right after it creates
// the tasks, so existing programs migrate exactly once and never re-duplicate.

migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.add(new BoolField({ name: "materialized" }));
    app.save(programs);
  },

  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.removeByName("materialized");
    app.save(programs);
  },
);
