import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";

// Deterministic seeded PRNG (mulberry32) so the tile is reproducible across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 160; // matches the old SVG filter's width/height
const rand = mulberry32(42); // fixed seed - reproducible tile
const png = new PNG({ width: SIZE, height: SIZE });

// Independent per-pixel gray noise. Unlike smooth/Perlin noise, uncorrelated white
// noise has no low-frequency structure to clash at tile edges, so a plain repeat is
// already seamless - no edge-blending needed.
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const idx = (SIZE * y + x) << 2;
    const gray = 90 + Math.floor(rand() * 75); // 90-165: matches the old filter's look
    png.data[idx] = gray;
    png.data[idx + 1] = gray;
    png.data[idx + 2] = gray;
    png.data[idx + 3] = 255;
  }
}

writeFileSync("src/assets/grain.png", PNG.sync.write(png));
console.log("wrote src/assets/grain.png (160x160)");
