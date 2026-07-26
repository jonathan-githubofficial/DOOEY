// CanvasKit is Skia's WebAssembly build, used only by the web target.
//
// Its loader fetches `/canvaskit.wasm` over the network at runtime, so the file
// has to exist as a real static asset at the web root. A dev server that does
// not have it answers with index.html instead, and WebAssembly reports the
// doctype it got handed as a corrupt magic word:
//
//     CompileError: expected magic word 00 61 73 6d, found 3c 21 44 4f
//
// Expo serves `public/` at the root in dev and copies it into the web export,
// so that is where it belongs. It is 8MB of somebody else's build output, so it
// is copied on install and gitignored rather than committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve("canvaskit-wasm/package.json")),
  "bin",
  "full",
  "canvaskit.wasm",
);
const target = join(import.meta.dirname, "..", "public");

mkdirSync(target, { recursive: true });
copyFileSync(source, join(target, "canvaskit.wasm"));
