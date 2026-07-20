/** Hand-drawn underline squiggle. Colour via `currentColor`; stretches to its box.
 *
 * Lynx's `<svg>` host element is a leaf (no nested JSX children - see
 * `@lynx-js/types` `SVGProps`: only `src`/`content`/`current-color`/`bindload`,
 * confirmed against https://lynxjs.org/api/elements/built-in/svg), so the stroke path is
 * a self-contained SVG XML string passed via `content`. NOTE (this unit's finding): on
 * the WEB target `content` is rendered through an internal blob-URL `<img>`
 * (`@lynx-js/web-elements` XSvg), which sandboxes `currentColor` to the browser default
 * (black) - the `current-color` override prop is native-only (`@lynx-js/types` does not
 * list `@web` for it). So `className`'s `text-*` colour utility sizes/positions this
 * element but does NOT tint the stroke on web; native hosts (unit 8.5) get real theming
 * via `current-color`. Recorded as a parity gap, not fixed here (out of this unit's
 * mechanical scope - see PARKED). */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      content={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none"><path d="M1 5.2C13 2 25 2 37 5.2S61 8.4 73 5.2 97 2 119 4.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`}
    />
  );
}
