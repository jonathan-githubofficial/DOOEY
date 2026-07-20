import { strokePath, type Stroke } from "@/lib/doodle";

/** Render strokes over whatever this is absolutely positioned against.
 *
 * Two width modes:
 * - default (screen-fixed): non-scaling-stroke keeps the pen width in screen
 *   pixels — right for big, possibly non-square surfaces (task pages).
 * - `relative`: the width lives in viewBox units, so the drawing scales as one
 *   piece — right for square art shown at many sizes (the avatar), where a
 *   fixed pixel width would look thick and muddy when scaled down. */
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
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className ?? "absolute inset-0 h-full w-full overflow-visible"}
    >
      {strokes.map((s, i) => (
        <path
          key={i}
          d={strokePath(s.points)}
          fill="none"
          stroke={`hsl(var(--${s.color}))`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
          vectorEffect={relative ? undefined : "non-scaling-stroke"}
        />
      ))}
    </svg>
  );
}
