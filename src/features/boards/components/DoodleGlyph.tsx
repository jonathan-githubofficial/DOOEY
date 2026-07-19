import type { Stroke } from "@/lib/doodle";
import { strokePath } from "@/lib/doodle";

/** Renders a saved doodle (normalized strokes: x 0–100, y 0–100/aspect) at a
 * given width. Stroke weight stays constant on screen no matter the size. */
export function DoodleGlyph({
  strokes,
  aspect,
  width,
  className,
}: {
  strokes: Stroke[];
  aspect: number;
  width: number;
  className?: string;
}) {
  const vh = 100 / aspect;
  return (
    <svg
      aria-hidden
      viewBox={`-4 -4 108 ${vh + 8}`}
      style={{ width, height: width / aspect }}
      className={className}
    >
      {strokes.map((s, i) => (
        <path
          key={i}
          d={strokePath(s.points)}
          fill="none"
          stroke={`hsl(var(--${s.color}))`}
          strokeWidth={2.5}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      ))}
    </svg>
  );
}
