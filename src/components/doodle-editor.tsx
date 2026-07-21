// The little drawing card (unit 7.3's shared pad, ported from
// src-legacy/components/doodle-editor.tsx): pad, four inks, pen/eraser/undo, save. Position it
// via className — it styles itself as a floating panel but doesn't decide where it lives.
//
// PORTED / DROPPED (recorded BROOM): the `motion.div` enter spring -> the shared `.animate-enter`
// keyframe (reduced-motion omits the class, unit 4.2 convention); lucide-react -> the 2.4 icon
// barrel; `setPointerCapture` + the DOM `pointerPct(e, el)` -> Lynx MTS `main-thread:bindtouch*`
// worklets. KEPT verbatim: `eraseNear`, the whole-gesture undo `history` snapshots, ERASE_RADIUS,
// the 0.6-delta point thinning, and the % coordinate space (what you draw is what you wear).
//
// CAPTURE ARCHITECTURE (spike finding 4 + the 5.2 gesture conventions): a pen stroke must not
// re-render React per touch move, so the moving point stream lives in a `useMainThreadRef` and the
// LIVE stroke paints by rebuilding the whole `<svg content>` string in the worklet — on the web
// target the Lynx <svg> host renders ONLY `content`/`src` (never child <path> JSX), and the spike
// proved a per-move `setAttribute("content", ...)` repaints (the #290 fallback ruling's happy
// branch). Worklets can capture same-scope MainThreadRefs + same-module constants but CANNOT call
// outer helpers, so the % math + string assembly are inlined in each handler. The pad rectangle is
// measured on the BACKGROUND thread (NodesRef boundingClientRect, WeekGrid/5.2 pattern) and
// mirrored into a MainThreadRef — touches[0].x/y and the rect are both LynxView-local on web, so
// pad-% = (t - rect) / size. Erasing re-renders per move by design (not the 60fps-critical path).
// On pen release the worklet clears the live svg and the committed stroke re-renders through
// DoodleSvg one background tick later — a one-frame handoff, accepted by the 7.3 ruling.
import { useEffect, useRef, useState } from "react";
import { runOnBackground, runOnMainThread, useMainThreadRef } from "@lynx-js/react";
import type { MainThread } from "@lynx-js/types";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Check, Eraser, Pencil, Undo2, X } from "@/components/icons/lucide";
import { DoodleSvg, DOODLE_HSL } from "@/components/doodle-svg";
import { Eyebrow } from "@/components/surface";
import { INK_COLORS, type InkColor, type Stroke } from "@/lib/doodle";
import { pressDown, pressUp } from "@/lib/motion/press";
import { useReducedMotion } from "@/stores";

/** How close (in % of the pad) the eraser has to pass to a point to remove it. */
const ERASE_RADIUS = 5;
/** Manhattan-delta below which a moving pen point is thinned out (legacy 0.6, % space). */
const PEN_THRESH = 0.6;
/** Whole-gesture undo snapshots kept (legacy cap). */
const HISTORY_MAX = 20;

// Live-stroke svg string pieces (same-module constants ARE capturable by worklets; the pen
// width/cap/opacity mirror DoodleSvg's relative rendering so the committed stroke lands exactly
// where the live one was).
const LIVE_PRE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
  '<path fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" stroke="';
const LIVE_MID = '" d="';
const LIVE_POST = '"/></svg>';
const LIVE_EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';

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
  const [ink, setInk] = useState<InkColor>("ink");
  const [tool, setTool] = useState<"pen" | "erase">("pen");
  const [saving, setSaving] = useState(false);
  const reduced = useReducedMotion();

  // Undo restores whole gestures (one full stroke, or one erase drag), not
  // individual points — a ref keeps the pre-gesture snapshot without forcing
  // a re-render on every touch move.
  const [history, setHistory] = useState<Stroke[][]>([]);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const gestureStart = useRef<Stroke[] | null>(null);

  // MTS gesture state + element handles (touched only inside 'main thread' worklets).
  const capRef = useMainThreadRef<{ active: boolean; erase: boolean; pts: [number, number][]; d: string }>({
    active: false,
    erase: false,
    pts: [],
    d: "",
  });
  const liveSvgRef = useMainThreadRef<MainThread.Element>(null);
  const eraserRef = useMainThreadRef<MainThread.Element>(null);
  const padRectRef = useMainThreadRef<{ left: number; top: number; width: number; height: number }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  // Background helpers the worklets reach via runOnBackground. Commit and erase write through
  // strokesRef (the render-time `strokes` would be stale inside a gesture).
  const commitStroke = (points: [number, number][]) => {
    setHistory((h) => [...h, strokesRef.current].slice(-HISTORY_MAX));
    setStrokes([...strokesRef.current, { color: ink, points }]);
  };
  const beginErase = (x: number, y: number) => {
    gestureStart.current = strokesRef.current;
    setStrokes(eraseNear(strokesRef.current, x, y, ERASE_RADIUS));
  };
  const eraseAt = (x: number, y: number) => {
    setStrokes((s) => eraseNear(s, x, y, ERASE_RADIUS));
  };
  const endErase = () => {
    // Only a real change earns an undo step — tapping empty space stays silent.
    if (gestureStart.current && gestureStart.current !== strokesRef.current) {
      const snapshot = gestureStart.current;
      setHistory((h) => [...h, snapshot].slice(-HISTORY_MAX));
    }
    gestureStart.current = null;
  };

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setStrokes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  // Pad rect -> MainThreadRef (5.2 pattern): background NodesRef boundingClientRect, mirrored via
  // runOnMainThread. Measured on mount, re-measured when the enter animation lands (the rect is
  // 14px high during `.animate-enter`) and refreshed at every gesture start (one-frame lag, fine).
  function applyPadRect(left: number, top: number, width: number, height: number) {
    "main thread";
    padRectRef.current = { left, top, width, height };
  }
  const measurePad = () => {
    lynx
      .createSelectorQuery()
      .select("#doodle-pad")
      .invoke({
        method: "boundingClientRect",
        params: { relativeTo: "screen" },
        success: (r: { left: number; top: number; width: number; height: number }) => {
          void runOnMainThread(applyPadRect)(r.left, r.top, r.width, r.height);
        },
      })
      .exec();
  };
  useEffect(() => {
    measurePad();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure once on mount; animationend + gesture starts re-measure
  }, []);

  function onPadDown(e: MainThread.TouchEvent) {
    "main thread";
    const t = e.touches[0];
    const r = padRectRef.current;
    const w = r.width || 1;
    const h = r.height || 1;
    let x = ((t.x - r.left) / w) * 100;
    let y = ((t.y - r.top) / h) * 100;
    x = Math.round((x < 0 ? 0 : x > 100 ? 100 : x) * 100) / 100;
    y = Math.round((y < 0 ? 0 : y > 100 ? 100 : y) * 100) / 100;
    const c = capRef.current;
    c.active = true;
    c.erase = e.currentTarget.getAttribute("data-tool") === "erase";
    if (c.erase) {
      c.pts = [];
      c.d = "";
      const cursor = eraserRef.current;
      if (cursor) cursor.setStyleProperties({ left: `${x}%`, top: `${y}%`, opacity: "1" });
      runOnBackground(beginErase)(x, y);
    } else {
      c.pts = [[x, y]];
      c.d = "M " + x + " " + y;
    }
    runOnBackground(measurePad)(); // refresh the rect for this/the next gesture (WeekGrid pattern)
  }
  function onPadMove(e: MainThread.TouchEvent) {
    "main thread";
    const c = capRef.current;
    if (!c.active) return;
    const t = e.touches[0];
    const r = padRectRef.current;
    const w = r.width || 1;
    const h = r.height || 1;
    let x = ((t.x - r.left) / w) * 100;
    let y = ((t.y - r.top) / h) * 100;
    x = Math.round((x < 0 ? 0 : x > 100 ? 100 : x) * 100) / 100;
    y = Math.round((y < 0 ? 0 : y > 100 ? 100 : y) * 100) / 100;
    if (c.erase) {
      const cursor = eraserRef.current;
      if (cursor) cursor.setStyleProperties({ left: `${x}%`, top: `${y}%` });
      runOnBackground(eraseAt)(x, y);
      return;
    }
    const last = c.pts[c.pts.length - 1];
    if (Math.abs(x - last[0]) + Math.abs(y - last[1]) <= PEN_THRESH) return;
    c.pts.push([x, y]);
    c.d += " L " + x + " " + y;
    const live = liveSvgRef.current;
    const color = e.currentTarget.getAttribute("data-stroke") || "hsl(28 12% 14%)";
    if (live) live.setAttribute("content", LIVE_PRE + color + LIVE_MID + c.d + LIVE_POST);
  }
  function onPadUp() {
    "main thread";
    const c = capRef.current;
    if (!c.active) return;
    c.active = false;
    if (c.erase) {
      const cursor = eraserRef.current;
      if (cursor) cursor.setStyleProperty("opacity", "0");
      runOnBackground(endErase)();
      return;
    }
    const pts = c.pts;
    c.pts = [];
    c.d = "";
    const live = liveSvgRef.current;
    if (live) live.setAttribute("content", LIVE_EMPTY);
    if (pts.length > 1) runOnBackground(commitStroke)(pts);
  }

  return (
    <view
      bindanimationend={measurePad}
      data-testid="doodle-editor"
      className={cn(
        "w-56 rounded-2xl border border-rule/70 bg-surface p-3 shadow-soft",
        !reduced && "animate-enter",
        className,
      )}
    >
      <Eyebrow>{heading}</Eyebrow>

      {/* Sibling order is load-bearing (5.2/5.3 finding): everything that re-renders (committed
          strokes, and DoodleSvg mounts/unmounts around empty) sits BEFORE the MTS-bound capture
          surface, which stays the LAST child. The live svg + eraser cursor are driven from the
          worklets via main-thread refs, never by React. */}
      <view
        id="doodle-pad"
        className="grain relative mt-2 aspect-square w-full overflow-hidden rounded-xl border border-rule/70 bg-paper"
      >
        {/* Relative widths in editor + display: what you draw is exactly what you wear. */}
        <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
        <svg
          main-thread:ref={liveSvgRef}
          data-testid="doodle-live"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
        <view
          aria-hidden
          main-thread:ref={eraserRef}
          className="pointer-events-none absolute h-[10%] w-[10%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/50 bg-ink/10 opacity-0"
        />
        <view
          main-thread:bindtouchstart={onPadDown}
          main-thread:bindtouchmove={onPadMove}
          main-thread:bindtouchend={onPadUp}
          main-thread:bindtouchcancel={onPadUp}
          data-tool={tool}
          data-stroke={DOODLE_HSL[ink]}
          data-testid="doodle-capture"
          className="absolute inset-0"
        />
      </view>

      <view className="mt-2 flex flex-wrap items-center justify-between gap-y-2">
        <view className="flex items-center gap-1">
          {tool === "pen" ? (
            INK_COLORS.map((c) => (
              <view
                key={c}
                bindtap={() => setInk(c)}
                user-interaction-enabled={true}
                main-thread:bindtouchstart={pressDown}
                main-thread:bindtouchend={pressUp}
                main-thread:bindtouchcancel={pressUp}
                accessibility-label={`${c} ink`}
                accessibility-traits="button"
                data-testid={`ink-${c}`}
                className={cn("h-4 w-4 rounded-full", ink === c && "ring-2 ring-ink/30")}
                style={{ backgroundColor: `hsl(var(--${c}))` }}
              />
            ))
          ) : (
            <text className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-sans">erasing</text>
          )}
        </view>
        <view className="flex items-center gap-0.5">
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
                await onSave(strokesRef.current);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check className="h-3.5 w-3.5" />
          </MiniTool>
        </view>
      </view>
    </view>
  );
}

/** A little round tool button. The old hover/text-colour states are dropped: no hover on Lynx,
 * and the 2.4 icons paint black on the web target regardless of text-* until 8.5's recolour. */
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
  onClick: () => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <view
      bindtap={disabled ? undefined : () => void onClick()}
      user-interaction-enabled={!disabled}
      main-thread:bindtouchstart={pressDown}
      main-thread:bindtouchend={pressUp}
      main-thread:bindtouchcancel={pressUp}
      data-press-scale="0.9"
      accessibility-label={label}
      accessibility-traits="button"
      data-testid={`doodle-tool-${label.toLowerCase().replace(/\s.*$/, "")}`}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full",
        active && "bg-zest/15 ring-1 ring-zest/30",
        accent && !active && "bg-leaf/15 ring-1 ring-leaf/30",
        disabled && "opacity-40",
      )}
    >
      {children}
    </view>
  );
}
