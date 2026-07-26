import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import { View } from "react-native";
import type { InkLayerProps } from "./InkLayer";

/** On the web, Skia is a WebAssembly build of CanvasKit that has to be fetched
 * before the drawing module can even be imported. Loading it here rather than
 * at app start means the download is paid for by opening a board, not by
 * opening the app — and every other screen stays as light as it was.
 *
 * `locateFile` is not optional. Left alone, CanvasKit resolves the wasm
 * against `document.currentScript.src`, which is the lazily loaded chunk this
 * component pulls in — so it asks for `/_expo/static/js/web/canvaskit.wasm`.
 * The dev server answers every unknown path with `index.html`, and
 * WebAssembly reports the doctype it was handed as a corrupt magic word
 * (`expected 00 61 73 6d, found 3c 21 44 4f` — that is `<!DO`). Pointing it at
 * the root, where `postinstall` puts the file, is what makes it find a wasm
 * module instead of an HTML page. */
export function InkCanvas(props: InkLayerProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import("./InkLayer")}
      componentProps={props}
      opts={{ locateFile: (file) => `/${file}` }}
      fallback={<View />}
    />
  );
}
