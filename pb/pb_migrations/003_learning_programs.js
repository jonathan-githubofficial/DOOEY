/// <reference path="../pb_data/types.d.ts" />

// A learning program imported from a learning-architect skill bundle. The skill's
// output files (PLAN.md, SCHEDULE.md, TESTS.md, …) are stored verbatim in `files`;
// `progress` tracks which schedule sessions the user has ticked.

migrate(
  (app) => {
    const programs = new Collection({
      type: "base",
      name: "learning_programs",
      fields: [
        { type: "relation", name: "owner",  required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text",     name: "goal",   required: true },
        { type: "json",     name: "files",  required: true },
        { type: "json",     name: "progress" },
      ],
      indexes: ["CREATE INDEX idx_learning_programs_owner ON learning_programs (owner)"],
      listRule:   "@request.auth.id != '' && owner = @request.auth.id",
      viewRule:   "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(programs);
  },

  (app) => {
    try { app.delete(app.findCollectionByNameOrId("learning_programs")); } catch (_) {}
  },
);
