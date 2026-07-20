import { strokePath, type Stroke } from "@/lib/doodle";

// Read-only doodle renderer (unit 3.3, ported from src-legacy/components/doodle-svg.tsx onto the
// Lynx <svg> element, v3.7+; crib "SVG"). PORT FINDING (verified against @lynx-js/web-elements
// XSvg + @lynx-js/types svg.d.ts): the Lynx web <svg> host renders ONLY the `src`/`content`
// props - `content` is turned into a `image/svg+xml` Blob and shown through a shadow-DOM <img>
// (templateXSvg -> `<img id="#img">`, observedAttributes = ['src','content'], no <slot>). Child
// <path> elements passed to <svg> are NOT rendered on the web target (same reason unit 2.4's
// icons render their glyphs via `content`, not composed <path> children). So the ported paths
// are composed into an SVG XML STRING and handed to `content`, preserving every attribute the
// old renderer set (viewBox, preserveAspectRatio, per-stroke d/stroke-width/linecap/linejoin/
// opacity).
//
// COLOUR FINDING: the blob-URL <img> is an isolated document that cannot resolve the host page's
// `hsl(var(--token))` custom properties (same sandbox as unit 2.4's `currentColor` icon finding),
// so stroke colours are resolved to explicit light-theme HSL here. zest/sky/clay keep their hue
// across themes; only `ink` differs in dark mode - a web-target doodle-recolour parity gap (root
// cause: the XSvg blob sandbox) recorded alongside the 2.4 icon-recolour gap for a later web
// recolour pass / native `current-color` (8.5). This does not affect 3.3's gate (the test user
// has no avatar_doodle; the dock/avatar fall back to the glyph).
const DOODLE_HSL: Record<string, string> = {
  ink: "hsl(28 12% 14%)",
  zest: "hsl(20 82% 54%)",
  sky: "hsl(208 66% 52%)",
  clay: "hsl(10 60% 53%)",
};

/** Render saved strokes read-only. `relative` keeps the pen width in viewBox units so the
 * drawing scales as one piece (the avatar + dock doodles). The old screen-fixed
 * `vectorEffect="non-scaling-stroke"` branch is emitted into the string for the non-relative
 * case only (task pages, unit 4.x); its fidelity through the blob-URL <img> is unverified and
 * left to 4.x's first non-relative consumer - 3.3's consumers all pass `relative`. */
export function DoodleSvg({
  strokes,
  strokeWidth = 2.5,
  relative = false,
  className,
}: {
  strokes: Stroke[];
  strokeWidth?: number;
  relative?: boolean;
  className?: string;
}) {
  if (strokes.length === 0) return null;
  const paths = strokes
    .map((s) => {
      const stroke = DOODLE_HSL[s.color] ?? DOODLE_HSL.ink;
      const vectorEffect = relative ? "" : ` vector-effect="non-scaling-stroke"`;
      return `<path d="${strokePath(s.points)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"${vectorEffect}/>`;
    })
    .join("");
  const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${paths}</svg>`;
  return <svg content={content} className={className ?? "absolute inset-0 h-full w-full"} />;
}
