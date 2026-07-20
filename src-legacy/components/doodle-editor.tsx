import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Eraser, Pencil, Undo2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { DoodleSvg } from "@/components/doodle-svg";
import { INK_COLORS, pointerPct, strokePath, type InkColor, type Stroke } from "@/lib/doodle";

/** How close (in % of the pad) the eraser has to pass to a point to remove it. */
const ERASE_RADIUS = 5;

/** Remove any part of any stroke within `radius` of (x, y). A stroke erased in
 * the middle splits into two — this is what makes it feel like a real eraser
 * instead of an all-or-nothing "clear". Runs of a single leftover point (which
 * can't render a line) are dropped. */
function eraseNear(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const result: Stroke[] = [];
  for (const s of strokes) {
    let run: [number, number][] = [];
    for (const p of s.points) {
      if (Math.hypot(p[0] - x, p[1] - y) > radius) {
        run.push(p);
      } else {
        if (run.length > 1) result.push({ color: s.color, points: run });
        run = [];
      }
    }
    if (run.length > 1) result.push({ color: s.color, points: run });
  }
  return result;
}

/** The little drawing card: pad, four inks, pen/eraser/undo, save. Position it
 * via className — it styles itself as a floating panel but doesn't decide
 * where it lives. */
export function DoodleEditor({
  heading,
  initial,
  onSave,
  onClose,
  className,
}: {
  heading: string;
  initial: Stroke[];
  onSave: (strokes: Stroke[]) => void | Promise<void>;
  onClose: () => void;
  className?: string;
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const [live, setLive] = useState<[number, number][] | null>(null);
  const [ink, setInk] = useState<InkColor>("ink");
  const [tool, setTool] = useState<"pen" | "erase">("pen");
  const [eraserAt, setEraserAt] = useState<[number, number] | null>(null);
  const [saving, setSaving] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);

  // Undo restores whole gestures (one full stroke, or one erase drag), not
  // individual points — a ref keeps the pre-gesture snapshot without forcing
  // a re-render on every pointermove.
  const [history, setHistory] = useState<Stroke[][]>([]);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const gestureStart = useRef<Stroke[] | null>(null);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setStrokes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 480, damping: 34 }}
      className={cn("w-56 rounded-2xl border border-rule/70 bg-surface p-3 shadow-soft", className)}
    >
      <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        {heading}
      </span>

      <div
        ref={padRef}
        className={cn(
          "grain relative mt-2 aspect-square w-full touch-none overflow-hidden rounded-xl border border-rule/70 bg-paper",
          tool === "pen" ? "cursor-crosshair" : "cursor-cell",
        )}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = pointerPct(e, padRef.current!);
          if (tool === "pen") {
            setLive([p]);
          } else {
            gestureStart.current = strokesRef.current;
            setEraserAt(p);
            setStrokes(eraseNear(strokesRef.current, p[0], p[1], ERASE_RADIUS));
          }
        }}
        onPointerMove={(e) => {
          const p = pointerPct(e, padRef.current!);
          if (tool === "pen") {
            if (!live) return;
            const last = live[live.length - 1];
            if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 0.6) setLive([...live, p]);
          } else if (gestureStart.current) {
            setEraserAt(p);
            setStrokes((s) => eraseNear(s, p[0], p[1], ERASE_RADIUS));
          }
        }}
        onPointerUp={() => {
          if (tool === "pen") {
            if (live && live.length > 1) {
              setHistory((h) => [...h, strokesRef.current].slice(-20));
              setStrokes([...strokesRef.current, { color: ink, points: live }]);
            }
            setLive(null);
          } else if (gestureStart.current) {
            // Only a real change earns an undo step — tapping empty space stays silent.
            if (gestureStart.current !== strokesRef.current) {
              setHistory((h) => [...h, gestureStart.current!].slice(-20));
            }
            gestureStart.current = null;
          }
          setEraserAt(null);
        }}
      >
        {/* Relative widths in editor + display: what you draw is exactly what you wear. */}
        <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
        {live && live.length > 1 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <path
              d={strokePath(live)}
              fill="none"
              stroke={`hsl(var(--${ink}))`}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {tool === "erase" && eraserAt && (
          <span
            aria-hidden
            style={{
              left: `${eraserAt[0]}%`,
              top: `${eraserAt[1]}%`,
              width: `${ERASE_RADIUS * 2}%`,
              height: `${ERASE_RADIUS * 2}%`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/50 bg-ink/10"
          />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2">
        <span className="flex items-center gap-1">
          {tool === "pen" ? (
            INK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`${c} ink`}
                onClick={() => setInk(c)}
                className={cn(
                  "h-4 w-4 rounded-full transition-transform active:scale-90",
                  ink === c && "ring-2 ring-ink/30 ring-offset-1 ring-offset-surface",
                )}
                style={{ backgroundColor: `hsl(var(--${c}))` }}
              />
            ))
          ) : (
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">erasing</span>
          )}
        </span>
        <span className="flex items-center gap-0.5">
          <MiniTool label="Pen" active={tool === "pen"} onClick={() => setTool("pen")}>
            <Pencil className="h-3.5 w-3.5" />
          </MiniTool>
          <MiniTool label="Eraser" active={tool === "erase"} onClick={() => setTool("erase")}>
            <Eraser className="h-3.5 w-3.5" />
          </MiniTool>
          <MiniTool label="Undo" disabled={history.length === 0} onClick={undo}>
            <Undo2 className="h-3.5 w-3.5" />
          </MiniTool>
          <MiniTool label="Cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </MiniTool>
          <MiniTool
            label="Save doodle"
            accent
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(strokes);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check className="h-3.5 w-3.5" />
          </MiniTool>
        </span>
      </div>
    </motion.div>
  );
}

function MiniTool({
  label,
  active,
  accent,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full transition-[color,background-color,transform] active:scale-90 disabled:opacity-40",
        active
          ? "bg-zest/15 text-zest ring-1 ring-zest/30"
          : accent
            ? "bg-leaf/15 text-leaf ring-1 ring-leaf/30"
            : "text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
