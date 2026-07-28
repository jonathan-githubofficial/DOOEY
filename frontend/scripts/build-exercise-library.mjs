// Rebuilds src/features/workouts/exercises.json from the upstream ExerciseDB
// dataset, pinned to the same commit the demo GIFs come from.
//
// Run it when the pin moves:  node scripts/build-exercise-library.mjs
//
// The app ships a trimmed copy rather than the raw 1.3MB file: it drops the
// gifUrl (derived from the id in library.ts, at two resolutions) and shortens
// the field names. Everything else is carried through verbatim — including
// `secondaryMuscles`, which an earlier hand-built copy of this file dropped,
// leaving every exercise in the app with exactly one muscle and the anatomical
// figure showing a bench press as chest and nothing else.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The same SHA as GIF_180 in library.ts. Both must move together: the ids in
// this file are what address the artwork in that one.
const SHA = "7cdc82e1a14b06799d16c819d1082f3debb425ce";
const SOURCE = `https://raw.githubusercontent.com/bootstrapping-lab/exercisedb-api/${SHA}/src/data/exercises.json`;

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "features",
  "workouts",
  "exercises.json",
);

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`${SOURCE} → ${res.status} ${res.statusText}`);
const upstream = await res.json();

const library = upstream.map((e) => ({
  id: e.exerciseId,
  name: e.name,
  targets: e.targetMuscles ?? [],
  secondary: e.secondaryMuscles ?? [],
  parts: e.bodyParts ?? [],
  equip: e.equipments ?? [],
  steps: e.instructions ?? [],
}));

const missing = library.filter((e) => !e.id || !e.name || e.targets.length === 0);
if (missing.length) throw new Error(`${missing.length} records have no id, name or target`);

writeFileSync(OUT, `${JSON.stringify(library, null, 2)}\n`);
console.log(
  `${library.length} exercises → ${OUT}\n` +
    `${library.filter((e) => e.secondary.length > 0).length} carry secondary muscles`,
);
