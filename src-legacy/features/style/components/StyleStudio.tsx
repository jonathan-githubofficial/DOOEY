import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel, Stamp, StampButton } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { DoodleSvg } from "@/components/doodle-svg";
import { DoodleEditor } from "@/components/doodle-editor";
import { useThemeStore } from "@/stores";
import {
  BACKDROP_LIMITS,
  BASE,
  BASE_BACKDROP,
  BASE_CROP,
  useStyleStore,
  type BackdropCrop,
  type Device,
} from "../store";
import {
  COLOR_TOKENS,
  DEFAULT_COLORS,
  FONT_STACKS,
  PRESETS,
  hexToTriplet,
  tripletToHex,
  type ColorKey,
  type FontKey,
  type Mode,
} from "../tokens";

/** The theme creator: recolour, refont and reshape the whole app, live.
 * Everything edits CSS variables at runtime and persists locally — the code
 * never changes. */
export function StyleStudio() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Every change applies instantly to the whole app and is saved on this device.
      </p>
      <PresetsPanel />
      <PalettePanel />
      <BackdropPanel />
      <PageDoodlesPanel />
      <TypePanel />
      <ShapePanel />
      <SpecimenPanel />
    </div>
  );
}

/* ---------------------------------------------------------------- presets */

function PresetsPanel() {
  const applyPreset = useStyleStore((s) => s.applyPreset);
  const resetAll = useStyleStore((s) => s.resetAll);
  return (
    <Panel>
      <Eyebrow>presets</Eyebrow>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {PRESETS.map((preset) => {
          const chips = (["paper", "surface", "zest"] as const).map(
            (k) => preset.colors.light[k] ?? DEFAULT_COLORS.light[k],
          );
          return (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className="flex items-center gap-2 rounded-full border border-rule/70 bg-surface py-1.5 pl-2 pr-3.5 text-sm font-medium text-ink shadow-soft transition-transform active:scale-95"
            >
              <span className="flex -space-x-1.5">
                {chips.map((triplet, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border border-rule/70"
                    style={{ background: `hsl(${triplet})`, zIndex: 3 - i }}
                  />
                ))}
              </span>
              {preset.label}
            </button>
          );
        })}
        <StampButton onClick={resetAll} className="ml-auto text-ink-muted">
          <RotateCcw className="h-3.5 w-3.5" /> Factory reset
        </StampButton>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Presets swap the palette; your fonts and shape settings stay put.
      </p>
    </Panel>
  );
}

/* ---------------------------------------------------------------- palette */

function PalettePanel() {
  const mode = useThemeStore((s) => s.theme);
  const setMode = useThemeStore((s) => s.set);
  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>palette</Eyebrow>
        <div className="inset-well flex rounded-full bg-ink/5 p-1">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium capitalize transition-colors",
                mode === m ? "bg-surface text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        You're editing the <span className="font-medium text-ink">{mode}</span> look — each mode
        keeps its own palette.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {COLOR_TOKENS.map((token) => (
          <ColorRow key={token.key} mode={mode} token={token} />
        ))}
      </div>
    </Panel>
  );
}

function ColorRow({
  mode,
  token,
}: {
  mode: Mode;
  token: { key: ColorKey; label: string; hint: string };
}) {
  const override = useStyleStore((s) => s.colors[mode][token.key]);
  const setColor = useStyleStore((s) => s.setColor);
  const resetColor = useStyleStore((s) => s.resetColor);
  const value = override ?? DEFAULT_COLORS[mode][token.key];
  return (
    <div className="flex items-center gap-3 border-b border-rule/40 py-2.5 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
      <label
        title={`Pick a ${token.label.toLowerCase()} colour`}
        className="relative h-9 w-9 shrink-0 cursor-pointer rounded-full border border-rule shadow-soft transition-transform active:scale-95"
        style={{ background: `hsl(${value})` }}
      >
        <input
          type="color"
          value={tripletToHex(value)}
          onChange={(e) => setColor(mode, token.key, hexToTriplet(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{token.label}</p>
        <p className="text-xs text-ink-muted">{token.hint}</p>
      </div>
      {override && (
        <button
          onClick={() => resetColor(mode, token.key)}
          title="Back to default"
          className="text-ink-muted transition-colors hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- backdrop */

function BackdropPanel() {
  const url = useStyleStore((s) => s.backdropUrl);
  const backdrop = useStyleStore((s) => s.backdrop);
  const setBackdrop = useStyleStore((s) => s.setBackdrop);
  const setBackdropCrop = useStyleStore((s) => s.setBackdropCrop);
  const setBackdropImage = useStyleStore((s) => s.setBackdropImage);
  const removeBackdropImage = useStyleStore((s) => s.removeBackdropImage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [device, setDevice] = useState<Device>(() =>
    window.matchMedia("(min-width: 768px)").matches ? "desktop" : "mobile",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const crop = backdrop[device];

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await setBackdropImage(file);
    } catch {
      setError("Couldn't read that image — try a JPG or PNG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>backdrop</Eyebrow>
        {url && (
          <div className="inset-well flex rounded-full bg-ink/5 p-1">
            {(["mobile", "desktop"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium capitalize transition-colors",
                  device === d ? "bg-surface text-ink shadow-soft" : "text-ink-muted hover:text-ink",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {!url ? (
        <>
          <p className="mt-3 max-w-prose text-sm text-ink-muted">
            A photo behind the whole app — blurred and faded within limits, so the paper stays
            readable and the picture stays an undertone.
          </p>
          <StampButton
            accent
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-4"
          >
            <ImagePlus className="h-4 w-4" /> {busy ? "…" : "Choose a photo"}
          </StampButton>
        </>
      ) : (
        <div className="mt-4 space-y-5">
          <CropPreview
            url={url}
            crop={crop}
            wide={device === "desktop"}
            onChange={(patch) => setBackdropCrop(device, patch)}
          />
          <p className="text-center text-xs text-ink-muted">
            Drag to reframe the {device} crop — each device remembers its own.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <SliderRow
              label={`Zoom (${device})`}
              display={`${crop.zoom.toFixed(2)}×`}
              value={crop.zoom}
              min={BACKDROP_LIMITS.zoom.min}
              max={BACKDROP_LIMITS.zoom.max}
              step={0.05}
              isDefault={crop.zoom === BASE_CROP.zoom}
              onChange={(v) => setBackdropCrop(device, { zoom: v })}
              onReset={() => setBackdropCrop(device, { ...BASE_CROP })}
            />
            <SliderRow
              label="Blur"
              display={`${backdrop.blur}px`}
              value={backdrop.blur}
              min={BACKDROP_LIMITS.blur.min}
              max={BACKDROP_LIMITS.blur.max}
              step={1}
              isDefault={backdrop.blur === BASE_BACKDROP.blur}
              onChange={(v) => setBackdrop({ blur: v })}
              onReset={() => setBackdrop({ blur: BASE_BACKDROP.blur })}
            />
            <SliderRow
              label="Visibility"
              display={`${Math.round(backdrop.opacity * 100)}%`}
              value={backdrop.opacity}
              min={BACKDROP_LIMITS.opacity.min}
              max={BACKDROP_LIMITS.opacity.max}
              step={0.05}
              isDefault={backdrop.opacity === BASE_BACKDROP.opacity}
              onChange={(v) => setBackdrop({ opacity: v })}
              onReset={() => setBackdrop({ opacity: BASE_BACKDROP.opacity })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <StampButton onClick={() => inputRef.current?.click()} disabled={busy}>
              <ImagePlus className="h-3.5 w-3.5" /> {busy ? "…" : "Replace"}
            </StampButton>
            <StampButton
              onClick={() => void removeBackdropImage()}
              className="text-ink-muted"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </StampButton>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
    </Panel>
  );
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A framing tool, not a preview: the photo at full strength in the target
 * device's aspect ratio. Dragging pans the crop's focal point. */
function CropPreview({
  url,
  crop,
  wide,
  onChange,
}: {
  url: string;
  crop: BackdropCrop;
  wide: boolean;
  onChange: (patch: Partial<BackdropCrop>) => void;
}) {
  const dragFrom = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  return (
    <div
      className={cn(
        "inset-well relative mx-auto cursor-grab touch-none select-none overflow-hidden rounded-2xl border border-rule/70 active:cursor-grabbing",
        wide ? "aspect-video w-full max-w-md" : "aspect-[9/19] h-72",
      )}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragFrom.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
      }}
      onPointerMove={(e) => {
        const from = dragFrom.current;
        if (!from) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onChange({
          x: clamp(from.x - ((e.clientX - from.px) / rect.width) * (150 / crop.zoom), 0, 100),
          y: clamp(from.y - ((e.clientY - from.py) / rect.height) * (150 / crop.zoom), 0, 100),
        });
      }}
      onPointerUp={() => (dragFrom.current = null)}
      onPointerCancel={() => (dragFrom.current = null)}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        className="pointer-events-none h-full w-full object-cover"
        style={{
          objectPosition: `${crop.x}% ${crop.y}%`,
          transform: `scale(${crop.zoom})`,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ page doodles */

const DOODLE_PAGES = [
  { key: "planner", label: "Planner" },
  { key: "calendar", label: "Calendar" },
  { key: "boards", label: "Boards" },
  { key: "learning", label: "Projects" },
  { key: "account", label: "Account" },
] as const;

/** Hand-drawn icons for the spaces: each page can wear a little doodle — next
 * to its title and as its icon in the dock — instead of a stock glyph. */
function PageDoodlesPanel() {
  const pageDoodles = useStyleStore((s) => s.pageDoodles);
  const setPageDoodle = useStyleStore((s) => s.setPageDoodle);
  const dockDoodles = useStyleStore((s) => s.dockDoodles);
  const setDockDoodles = useStyleStore((s) => s.setDockDoodles);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>page doodles</Eyebrow>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
          <span>doodle icons in dock</span>
          <button
            type="button"
            role="switch"
            aria-checked={dockDoodles}
            aria-label="Use doodles as dock icons"
            onClick={() => setDockDoodles(!dockDoodles)}
            className={cn(
              "inset-well relative flex h-5 w-9 items-center rounded-full px-0.5 transition-colors",
              dockDoodles ? "bg-zest/30" : "bg-ink/10",
            )}
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className={cn("h-4 w-4 rounded-full bg-surface shadow-soft", dockDoodles && "ml-auto")}
            />
          </button>
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Draw a little mark for each space — it appears next to the page title, and (when the
        switch is on) as its icon in the dock.
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        {DOODLE_PAGES.map((p) => {
          const strokes = pageDoodles[p.key] ?? [];
          return (
            <div key={p.key} className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => setEditing((e) => (e === p.key ? null : p.key))}
                aria-label={`Doodle the ${p.label} icon`}
                className={cn(
                  "grain relative flex h-16 w-16 items-center justify-center rounded-2xl border bg-paper shadow-soft transition-transform active:scale-95",
                  editing === p.key ? "border-zest" : "border-rule/70",
                )}
              >
                {strokes.length ? (
                  <span className="relative h-12 w-12">
                    <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
                  </span>
                ) : (
                  <Pencil className="h-4 w-4 text-ink-muted/50" />
                )}
              </button>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {editing && (
          <DoodleEditor
            key={editing}
            heading={`${editing} icon`}
            initial={pageDoodles[editing] ?? []}
            className="mt-3"
            onClose={() => setEditing(null)}
            onSave={(strokes) => {
              setPageDoodle(editing, strokes);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </Panel>
  );
}

/* ------------------------------------------------------------------- type */

function TypePanel() {
  const fontDisplay = useStyleStore((s) => s.fontDisplay);
  const fontSans = useStyleStore((s) => s.fontSans);
  const setFont = useStyleStore((s) => s.setFont);
  return (
    <Panel>
      <Eyebrow>type</Eyebrow>
      <div className="mt-4 space-y-5">
        <FontPicker
          label="Display — titles & big numbers"
          active={fontDisplay}
          onPick={(f) => setFont("display", f)}
        />
        <FontPicker
          label="Body — everything else"
          active={fontSans}
          onPick={(f) => setFont("sans", f)}
        />
      </div>
    </Panel>
  );
}

function FontPicker({
  label,
  active,
  onPick,
}: {
  label: string;
  active: FontKey;
  onPick: (f: FontKey) => void;
}) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FONT_STACKS.map((font) => (
          <button
            key={font.key}
            onClick={() => onPick(font.key)}
            style={{ fontFamily: font.stack }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors active:scale-95",
              active === font.key
                ? "border-zest bg-zest/10 font-semibold text-ink"
                : "border-rule text-ink-muted hover:text-ink",
            )}
          >
            {font.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shape */

function ShapePanel() {
  const radius = useStyleStore((s) => s.radius);
  const grain = useStyleStore((s) => s.grain);
  const shadow = useStyleStore((s) => s.shadow);
  const setShape = useStyleStore((s) => s.setShape);
  return (
    <Panel>
      <Eyebrow>shape &amp; feel</Eyebrow>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <SliderRow
          label="Corners"
          display={`${Math.round(radius * 16)}px`}
          value={radius}
          min={0}
          max={3}
          step={0.125}
          isDefault={radius === BASE.radius}
          onChange={(v) => setShape({ radius: v })}
          onReset={() => setShape({ radius: BASE.radius })}
        />
        <SliderRow
          label="Paper grain"
          display={`${Math.round(grain * 100)}%`}
          value={grain}
          min={0}
          max={2}
          step={0.1}
          isDefault={grain === BASE.grain}
          onChange={(v) => setShape({ grain: v })}
          onReset={() => setShape({ grain: BASE.grain })}
        />
        <SliderRow
          label="Shadows"
          display={`${Math.round(shadow * 100)}%`}
          value={shadow}
          min={0}
          max={2}
          step={0.1}
          isDefault={shadow === BASE.shadow}
          onChange={(v) => setShape({ shadow: v })}
          onReset={() => setShape({ shadow: BASE.shadow })}
        />
      </div>
    </Panel>
  );
}

function SliderRow({
  label,
  display,
  value,
  min,
  max,
  step,
  isDefault,
  onChange,
  onReset,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isDefault: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-ink-muted">{label}</p>
        <span className="flex items-center gap-1.5 text-xs tabular-nums text-ink-muted">
          {display}
          {!isDefault && (
            <button
              onClick={onReset}
              title="Back to default"
              className="transition-colors hover:text-ink"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-zest"
        aria-label={label}
      />
    </div>
  );
}

/* --------------------------------------------------------------- specimen */

function SpecimenPanel() {
  return (
    <Panel>
      <Eyebrow>specimen</Eyebrow>
      <h3 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
        Sphinx of quartz, judge my vow.
      </h3>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">
        Body text sits like this — lists, notes, and the quiet parts of the day. The dot on the
        wordmark, progress washes and highlights all take the accent.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm">button</Button>
        <Button size="sm" variant="accent">
          accent
        </Button>
        <StampButton>stamp</StampButton>
        <Stamp className="border-leaf text-leaf">done</Stamp>
        <span className="flex gap-1.5">
          {(["leaf", "zest", "sky", "clay", "honey"] as const).map((k) => (
            <span
              key={k}
              className="h-4 w-4 rounded-full"
              style={{ background: `hsl(var(--${k}))` }}
              title={k}
            />
          ))}
        </span>
      </div>
    </Panel>
  );
}
