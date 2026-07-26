/// <reference path="../pb_data/types.d.ts" />

// A routine's card is something you design: `hue` names the palette accent its
// colour field is drawn from, `emblem` holds the doodle you draw for it (the
// same percent-coordinate stroke JSON as page doodles and the avatar). Both
// stay empty until you choose — an untouched routine falls back to the accent
// of the muscle it trains and the gym page doodle.

migrate(
  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.add(new TextField({ name: "hue", max: 10 }));
    routines.fields.add(new JSONField({ name: "emblem" })); // Stroke[] in %
    app.save(routines);
  },

  (app) => {
    const routines = app.findCollectionByNameOrId("routines");
    routines.fields.removeByName("hue");
    routines.fields.removeByName("emblem");
    app.save(routines);
  },
);
