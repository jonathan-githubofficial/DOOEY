/// <reference path="../pb_data/types.d.ts" />

// `goal` is the folder's short title (≤5 words). `why` is the one-line reason it
// matters, shown under the title. Both are user-editable from the UI.

migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.add(new TextField({ name: "why" }));
    app.save(programs);
  },

  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.removeByName("why");
    app.save(programs);
  },
);
