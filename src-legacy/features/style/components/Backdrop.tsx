import { useStyleStore, type BackdropCrop } from "../store";

/** The user's photo behind the whole app. It sits under the paper grain
 * (which keeps multiplying on top) and shows through at capped opacity, so
 * the paper colour still tints it and content stays readable. Phone and
 * desktop each get their own framing. */
export function Backdrop() {
  const url = useStyleStore((s) => s.backdropUrl);
  const settings = useStyleStore((s) => s.backdrop);
  if (!url) return null;

  const image = (crop: BackdropCrop) => (
    <img
      src={url}
      alt=""
      className="h-full w-full object-cover"
      style={{
        objectPosition: `${crop.x}% ${crop.y}%`,
        // slight overscale hides the transparent fringe blur leaves at the edges
        transform: `scale(${crop.zoom * (1 + settings.blur / 300)})`,
        filter: settings.blur > 0 ? `blur(${settings.blur}px)` : undefined,
        opacity: settings.opacity,
      }}
    />
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div className="h-full w-full md:hidden">{image(settings.mobile)}</div>
      <div className="hidden h-full w-full md:block">{image(settings.desktop)}</div>
    </div>
  );
}
