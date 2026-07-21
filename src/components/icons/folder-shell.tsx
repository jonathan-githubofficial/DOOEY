/** The folder silhouette shared by project folders and board folders: a
 * contoured tab flowing into the body, stretched to whatever box it fills.
 *
 * Lynx's `<svg>` host element is a leaf (no nested JSX children - see
 * `@lynx-js/types` `SVGProps`: only `src`/`content`/`current-color`/`bindload`,
 * confirmed against https://lynxjs.org/api/elements/built-in/svg), so the shape is a
 * self-contained SVG XML string passed via `content`; `fill` is interpolated in since it
 * is per-instance (not `currentColor`). */
export function FolderShell({ fill, className }: { fill: string; className?: string }) {
  return (
    <svg
      className={className ?? "absolute inset-0 h-full w-full"}
      content={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 88" preserveAspectRatio="none"><path d="M 0 78 V 10 Q 0 0 8 0 H 30 Q 36 0 40 5 L 44 10 Q 47 14 53 14 H 92 Q 100 14 100 24 V 78 Q 100 88 92 88 H 8 Q 0 88 0 78 Z" fill="${fill}"/></svg>`}
    />
  );
}
