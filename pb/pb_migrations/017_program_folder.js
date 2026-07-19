/// <reference path="../pb_data/types.d.ts" />

// Folder customization for a project (learning program): `folder` holds the
// chosen hue, title font and a doodle drawn on the folder; `cover` is an
// optional picture that fills the folder front.

migrate(
  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.add(new JSONField({ name: "folder" }));
    programs.fields.add(
      new FileField({
        name: "cover",
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
      }),
    );
    app.save(programs);
  },

  (app) => {
    const programs = app.findCollectionByNameOrId("learning_programs");
    programs.fields.removeByName("folder");
    programs.fields.removeByName("cover");
    app.save(programs);
  },
);
