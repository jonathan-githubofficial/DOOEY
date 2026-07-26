/// <reference path="../pb_data/types.d.ts" />

// Project tasks: a task can belong to a learning program (project). `project`
// links to the program (cascade-deleted with it), `gate` marks a milestone
// session, and `session_key` records the SCHEDULE.md line it was materialized
// from — so re-importing a bundle never duplicates its sessions.

migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    const programs = app.findCollectionByNameOrId("learning_programs");
    tasks.fields.add(
      new RelationField({
        name: "project",
        collectionId: programs.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      }),
    );
    tasks.fields.add(new BoolField({ name: "gate" }));
    tasks.fields.add(new TextField({ name: "session_key" }));
    app.save(tasks);
  },

  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.removeByName("project");
    tasks.fields.removeByName("gate");
    tasks.fields.removeByName("session_key");
    app.save(tasks);
  },
);
