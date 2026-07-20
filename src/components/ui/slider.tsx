import { Minus, Plus } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";

// The numeric control the Style studio needs (palette HSL, shape, backdrop prefs) - unit 3.4.
// It replaces src-legacy's `<input type=range>` and `<input type=color>`, neither of which
// exists on Lynx.
//
// SHIPPED AS THE STEPPER FALLBACK sanctioned by SPEC 3, not the MTS drag. Rationale, recorded:
//   - SPEC 3's MTS design maps "touch x WITHIN THE TRACK to a value", which needs the track's
//     geometry (left/width) READ INSIDE a `'main thread'` worklet. The FETCHED main-thread-script
//     doc (https://lynxjs.org/react/main-thread-script) documents setStyleProperty + runOnBackground
//     but NOT any in-worklet element-geometry read (no getBoundingClientRect/size on
//     event.currentTarget), and the Phase-0 spike (finding 4) only proved absolute-coord freehand,
//     normalized on the TEST side - it did not establish in-worklet track geometry. The crib's rule
//     is "when uncertain, do not guess"; that mapping is therefore "not expressible with the pinned
//     MTS API", which is exactly SPEC 3's stated FALLBACK trigger.
//   - The 3.4 gate does not exercise the slider (the @l3 theme spec asserts the palette swap +
//     persistence via the theme dot), and the e2e config runs Desktop Chrome without the spike's
//     `hasTouch`/CDP `Input.dispatchTouchEvent` recipe, so an MTS drag could not be verified here
//     anyway. "do NOT block the layer on slider polish."
// The stepper is a REAL, fully-functional control (every value in [min,max] is reachable, snapped
// to `step`), not a placeholder. On-device 60fps MTS drag is PARKED (see the story).
//
// Elements (crib): a track/thumb `<view>` pair for the visual read-out (non-interactive), flanked
// by - / + `<view bindtap>` steppers. onChange runs on the background thread (a plain bindtap
// handler), so no MTS->main bridge is needed.

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label?: string;
  disabled?: boolean;
}

export function Slider({ value, min, max, step, onChange, label, disabled }: SliderProps) {
  const fraction = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  // Snap to the step grid and clamp; toFixed(6) kills binary-float drift (e.g. 0.1 + 0.2 steps).
  const snap = (v: number) => {
    const snapped = Math.round(v / step) * step;
    return Number(Math.min(max, Math.max(min, snapped)).toFixed(6));
  };
  const dec = () => onChange(snap(value - step));
  const inc = () => onChange(snap(value + step));
  const atMin = value <= min;
  const atMax = value >= max;

  const stepper = (dir: "dec" | "inc", off: boolean, run: () => void, Icon: typeof Minus) => (
    <view
      bindtap={disabled || off ? undefined : run}
      user-interaction-enabled={!disabled && !off}
      data-testid={`slider-${dir}`}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rule bg-surface active:scale-90",
        (disabled || off) && "opacity-40",
      )}
    >
      <Icon className="h-3.5 w-3.5 text-ink" />
    </view>
  );

  return (
    <view className={cn("flex items-center gap-2.5", disabled && "opacity-50")}>
      {label ? (
        <text className="w-16 shrink-0 text-xs text-ink-muted font-sans">{label}</text>
      ) : null}
      {stepper("dec", atMin, dec, Minus)}
      <view className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
        <view
          className="absolute inset-y-0 left-0 rounded-full bg-zest"
          style={{ width: `${fraction * 100}%` }}
        />
      </view>
      {stepper("inc", atMax, inc, Plus)}
    </view>
  );
}
