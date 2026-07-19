/// <reference path="../pb_data/types.d.ts" />

// Scrapbook moves from per-day planner pages onto the task page itself (user
// decision 2026-07-16): a task record now carries its own doodle strokes,
// placed decorations, and decoration photos. learning_programs gains `layout`
// (per-session metadata: agenda sort + notes) so sessions behave like tasks in
// the planner. users gain `avatar_doodle` — the hand-drawn profile picture.

migrate(
  (app) => {
    try { app.delete(app.findCollectionByNameOrId("planner_pages")); } catch (_) {}

    const tasks = app.findCollectionByNameOrId("tasks");
    tasks.fields.add(new JSONField({ name: "doodle" }));  // [{ color, points: [[x,y]…] }] in %
    tasks.fields.add(new JSONField({ name: "decor" }));   // [{ id, kind, emoji?, file?, x, y, rot, style? }]
    tasks.fields.add(new FileField({ name: "decor_photos", maxSelect: 30, maxSize: 20971520 }));
    app.save(tasks);

    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.add(new JSONField({ name: "layout" })); // { [sessionKey]: { sort?, notes? } }
    app.save(programs);

    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new JSONField({ name: "avatar_doodle" }));
    app.save(users);
  },

  (app) => {
    const tasks = app.findCollectionByNameOrId("tasks");
    for (const f of ["doodle", "decor", "decor_photos"]) tasks.fields.removeByName(f);
    app.save(tasks);
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.removeByName("layout");
    app.save(programs);
    const users = app.findCollectionByNameOrId("users");
    users.fields.removeByName("avatar_doodle");
    app.save(users);
  },
);
