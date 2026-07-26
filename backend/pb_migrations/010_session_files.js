/// <reference path="../pb_data/types.d.ts" />

// Session pages get full task-page parity (attachments + scrapbook photos).
// The files live on the program record; layout[sessionKey] holds the filenames.

migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.add(new FileField({ name: "session_files", maxSelect: 99, maxSize: 20971520 }));
    app.save(programs);
  },

  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.removeByName("session_files");
    app.save(programs);
  },
);
