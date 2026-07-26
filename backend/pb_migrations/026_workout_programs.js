/// <reference path="../pb_data/types.d.ts" />

// Programs group routines. A workout_program is a named folder of routines you
// own — a famous split you added, or one you built. routines gain a `program`
// relation (cascade-deleted with the program; logged workouts are untouched).
// Existing loose routines are gathered into a per-owner "My Routines" program so
// nothing is left unfiled — the gym home is programs-only from here on.

migrate(
  (app) => {
    const programs = new Collection({
      type: "base",
      name: "workout_programs",
      fields: [
        { type: "relation", name: "owner", required: true, collectionId: "_pb_users_auth_", cascadeDelete: false },
        { type: "text", name: "name", required: true, max: 80 },
        { type: "text", name: "description", max: 160 },
        { type: "number", name: "position" },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
      indexes: ["CREATE INDEX idx_workout_programs_owner ON workout_programs (owner)"],
      listRule: "@request.auth.id != '' && owner = @request.auth.id",
      viewRule: "@request.auth.id != '' && owner = @request.auth.id",
      createRule: "@request.auth.id != '' && owner = @request.auth.id",
      updateRule: "@request.auth.id != '' && owner = @request.auth.id",
      deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(programs);

    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.add(
      new RelationField({
        name: "program",
        collectionId: programs.id,
        cascadeDelete: true,
        maxSelect: 1,
        required: false,
      }),
    );
    app.save(routines);

    // Backfill: gather each owner's existing routines into a "My Routines" program.
    const existing = app.findAllRecords("routines");
    const byOwner = {};
    for (const r of existing) {
      const owner = r.get("owner");
      if (!owner) continue;
      if (!byOwner[owner]) {
        const p = new Record(programs);
        p.set("owner", owner);
        p.set("name", "My Routines");
        p.set("description", "");
        p.set("position", 0);
        app.save(p);
        byOwner[owner] = p.id;
      }
      r.set("program", byOwner[owner]);
      app.save(r);
    }
  },

  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.removeByName("program");
    app.save(routines);
    try {
      app.delete(app.findCollectionByNameOrId("workout_programs"));
    } catch (_) {}
  },
);
