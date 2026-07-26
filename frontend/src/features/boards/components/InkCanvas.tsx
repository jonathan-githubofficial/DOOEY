import InkLayer, { type InkLayerProps } from "./InkLayer";

/** Native builds talk to Skia directly. The web build has its own copy of this
 * file, because there CanvasKit has to be fetched before the module can even
 * be imported. */
export function InkCanvas(props: InkLayerProps) {
  return <InkLayer {...props} />;
}
