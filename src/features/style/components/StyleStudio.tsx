import { useState } from "react";

import { cn } from "@/lib/cn";
import { Eyebrow, Panel, Stamp, StampButton } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DoodleSvg } from "@/components/doodle-svg";
import { Pencil, RotateCcw } from "@/components/icons/lucide";
import { useThemeStore } from "@/stores";
import {
  BACKDROP_LIMITS,
  BASE,
  BASE_BACKDROP,
  BASE_CROP,
  useStyleStore,
  type Device,
} from "../store";
import {
  COLOR_TOKENS,
  DEFAULT_COLORS,
  FONT_STACKS,
  PRESETS,
  type ColorKey,
  type FontKey,
  type Mode,
} from "../tokens";

/** The theme creator: recolour, refont and reshape the whole app, live (unit 3.4, ported
 * panel-by-panel from src-legacy/features/style/components/StyleStudio.tsx onto Lynx elements).
 *
 * Every change edits the reactive theme store; <ThemeVars> re-renders the app-root CSS variables,
 * so it applies instantly to the whole app and persists via the 1.4 storage adapter - the code
 * never changes.
 *
 * PORTED / DROPPED (recorded in the unit result):
 *  - <div>/<p>/<span>/<h3>/<label> -> <view>/<text> (crib "Elements"; <text> carries colour+font).
 *  - <button> -> <view bindtap user-interaction-enabled> (Lynx has no <button>).
 *  - motion/react (PageDoodlesPanel switch knob) -> a CSS transform transition.
 *  - lucide-react (RotateCcw, ImagePlus, Pencil, Trash2) -> the 2.4 inline-svg icon set.
 *  - <input type=color> (palette) -> THREE Sliders editing the H/S/L triplet directly (SPEC 4).
 *  - <input type=range> (shape/backdrop) -> the Slider primitive (SPEC 3, stepper build).
 *  - <input type=file> + CropPreview + DoodleEditor + the image choose/replace/remove flow ->
 *    DEFERRED (SPEC 5 backdrop image pipeline -> a later media unit + PARK native; page-doodle
 *    EDITING -> unit 7.3). This studio ships the backdrop numeric PREFS + read-only doodle tiles. */
export function StyleStudio() {
  return (
    <view data-testid="style-studio" className="flex flex-col gap-4">
      <text className="text-sm text-ink-muted font-sans">
        Every change applies instantly to the whole app and is saved on this device.
      </text>
      <PresetsPanel />
      <PalettePanel />
      <BackdropPanel />
      <PageDoodlesPanel />
      <TypePanel />
      <ShapePanel />
      <SpecimenPanel />
    </view>
  );
}

/* ---------------------------------------------------------------- presets */

function PresetsPanel() {
  const applyPreset = useStyleStore((s) => s.applyPreset);
  const resetAll = useStyleStore((s) => s.resetAll);
  return (
    <Panel>
      <Eyebrow>presets</Eyebrow>
      <view className="mt-3 flex flex-wrap items-center gap-2.5">
        {PRESETS.map((preset) => {
          const chips = (["paper", "surface", "zest"] as const).map(
            (k) => preset.colors.light[k] ?? DEFAULT_COLORS.light[k],
          );
          return (
            <view
              key={preset.key}
              bindtap={() => applyPreset(preset.key)}
              user-interaction-enabled={true}
              data-testid={`preset-${preset.key}`}
              className="flex items-center gap-2 rounded-full border border-rule/70 bg-surface py-1.5 pl-2 pr-3.5 shadow-soft active:scale-95"
            >
              <view className="flex flex-row">
                {chips.map((triplet, i) => (
                  <view
                    key={i}
                    className={cn("h-5 w-5 rounded-full border border-rule/70", i > 0 && "-ml-1.5")}
                    style={{ backgroundColor: `hsl(${triplet})` }}
                  />
                ))}
              </view>
              <text className="text-sm font-medium text-ink font-sans">{preset.label}</text>
            </view>
          );
        })}
        <StampButton onClick={resetAll} className="ml-auto text-ink-muted">
          <RotateCcw className="h-3.5 w-3.5 text-ink-muted" />
          <text className="text-sm font-medium text-ink-muted font-sans">Factory reset</text>
        </StampButton>
      </view>
      <text className="mt-3 block text-xs text-ink-muted font-sans">
        Presets swap the palette; your fonts and shape settings stay put.
      </text>
    </Panel>
  );
}

/* ---------------------------------------------------------------- palette */

function PalettePanel() {
  const mode = useThemeStore((s) => s.theme);
  const setMode = useThemeStore((s) => s.set);
  return (
    <Panel>
      <view className="flex items-center justify-between gap-4">
        <Eyebrow>palette</Eyebrow>
        <Segmented
          options={["light", "dark"] as const}
          value={mode}
          onPick={(m) => setMode(m)}
        />
      </view>
      <text className="mt-2 block text-xs text-ink-muted font-sans">
        You're editing the {mode} look - each mode keeps its own palette.
      </text>
      <view className="mt-4 flex flex-col gap-1">
        {COLOR_TOKENS.map((token) => (
          <ColorRow key={token.key} mode={mode} token={token} />
        ))}
      </view>
    </Panel>
  );
}

// Parse / serialize the "H S% L%" triplet global.css expects (same shape tokens.ts parses in
// tripletToHex). Editing the three channels as numbers replaces the native colour dialog.
function parseTriplet(t: string): { h: number; s: number; l: number } {
  const m = t.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return { h: 0, s: 0, l: 0 };
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}
const serializeTriplet = (h: number, s: number, l: number) =>
  `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;

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
  const { h, s, l } = parseTriplet(value);
  const put = (next: { h?: number; s?: number; l?: number }) =>
    setColor(mode, token.key, serializeTriplet(next.h ?? h, next.s ?? s, next.l ?? l));
  return (
    <view className="flex flex-col gap-2 border-b border-rule/40 py-3 last:border-b-0">
      <view className="flex items-center gap-3">
        <view
          className="h-9 w-9 shrink-0 rounded-full border border-rule shadow-soft"
          style={{ backgroundColor: `hsl(${value})` }}
        />
        <view className="min-w-0 flex-1">
          <text className="block text-sm font-medium text-ink font-sans">{token.label}</text>
          <text className="block text-xs text-ink-muted font-sans">{token.hint}</text>
        </view>
        {override ? (
          <view
            bindtap={() => resetColor(mode, token.key)}
            user-interaction-enabled={true}
            className="flex h-7 w-7 items-center justify-center rounded-full active:scale-90"
          >
            <RotateCcw className="h-3.5 w-3.5 text-ink-muted" />
          </view>
        ) : null}
      </view>
      <Slider label="Hue" value={h} min={0} max={360} step={1} onChange={(v) => put({ h: v })} />
      <Slider label="Sat" value={s} min={0} max={100} step={1} onChange={(v) => put({ s: v })} />
      <Slider label="Light" value={l} min={0} max={100} step={1} onChange={(v) => put({ l: v })} />
    </view>
  );
}

/* --------------------------------------------------------------- backdrop */

// SPEC 5: wire the numeric PREFS to the 2.2 Backdrop; DEFER the image itself. The Backdrop renders
// only when backdropUrl is set, and image upload (file picking, createImageBitmap/<canvas> encode,
// IndexedDB backdrop.ts, the pointer-drag CropPreview) is deferred to a later media unit + PARKED
// on native (no file system on the Sparkling host). OPEN QUESTION recorded in the unit result: no
// L1-L8 layer clearly owns web image upload (nearest is L4 task attachments). These sliders persist
// now and will drive the backdrop once an image exists.
function BackdropPanel() {
  const backdrop = useStyleStore((s) => s.backdrop);
  const setBackdrop = useStyleStore((s) => s.setBackdrop);
  const setBackdropCrop = useStyleStore((s) => s.setBackdropCrop);
  // No window.matchMedia (R11: no BOM in the worker) - default to mobile; the toggle picks device.
  const [device, setDevice] = useState<Device>("mobile");
  const crop = backdrop[device];
  return (
    <Panel>
      <view className="flex items-center justify-between gap-4">
        <Eyebrow>backdrop</Eyebrow>
        <Segmented
          options={["mobile", "desktop"] as const}
          value={device}
          onPick={(d) => setDevice(d)}
        />
      </view>
      <text className="mt-3 block max-w-prose text-sm text-ink-muted font-sans">
        A photo can sit behind the whole app - blurred and faded within limits, so the paper stays
        readable. These settings are ready; adding the photo itself arrives in a later update.
      </text>
      <view className="mt-4 flex flex-col gap-5">
        <SliderRow
          label={`Zoom (${device})`}
          display={`${crop.zoom.toFixed(2)}x`}
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
      </view>
    </Panel>
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

/** Hand-drawn icons for the spaces. The tiles are READ-ONLY here: the DoodleEditor + setPageDoodle
 * writes are deferred to unit 7.3 (they are drawn on Boards), so no dead editor button is shipped
 * (CLAUDE.md no-placeholder). The `dockDoodles` on/off switch stays. */
function PageDoodlesPanel() {
  const pageDoodles = useStyleStore((s) => s.pageDoodles);
  const dockDoodles = useStyleStore((s) => s.dockDoodles);
  const setDockDoodles = useStyleStore((s) => s.setDockDoodles);
  return (
    <Panel>
      <view className="flex items-center justify-between gap-4">
        <Eyebrow>page doodles</Eyebrow>
        <view
          bindtap={() => setDockDoodles(!dockDoodles)}
          user-interaction-enabled={true}
          data-testid="dock-doodles-switch"
          className="flex items-center gap-2"
        >
          <text className="text-xs text-ink-muted font-sans">doodle icons in dock</text>
          {/* motion/react knob -> a CSS transform transition on a persistent element. */}
          <view
            className={cn(
              "relative flex h-5 w-9 items-center rounded-full px-0.5",
              dockDoodles ? "bg-zest/30" : "bg-ink/10",
            )}
          >
            <view
              className={cn(
                "h-4 w-4 rounded-full bg-surface shadow-soft transition-transform duration-200 ease-out",
                dockDoodles ? "translate-x-4" : "translate-x-0",
              )}
            />
          </view>
        </view>
      </view>
      <text className="mt-2 block text-xs text-ink-muted font-sans">
        Each space can wear a little mark next to its title, and (when the switch is on) as its
        icon in the dock. Draw them on Boards.
      </text>
      <view className="mt-3 flex flex-wrap gap-4">
        {DOODLE_PAGES.map((p) => {
          const strokes = pageDoodles[p.key] ?? [];
          return (
            <view key={p.key} className="flex flex-col items-center gap-1.5">
              <view className="grain relative flex h-16 w-16 items-center justify-center rounded-2xl border border-rule/70 bg-paper shadow-soft">
                {strokes.length ? (
                  <view className="relative h-12 w-12">
                    <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
                  </view>
                ) : (
                  <Pencil className="h-4 w-4 text-ink-muted" />
                )}
              </view>
              <text className="text-[10px] uppercase tracking-[0.14em] text-ink-muted font-sans">
                {p.label}
              </text>
            </view>
          );
        })}
      </view>
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
      <view className="mt-4 flex flex-col gap-5">
        <FontPicker
          label="Display - titles & big numbers"
          active={fontDisplay}
          onPick={(f) => setFont("display", f)}
        />
        <FontPicker
          label="Body - everything else"
          active={fontSans}
          onPick={(f) => setFont("sans", f)}
        />
      </view>
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
    <view>
      <text className="block text-xs text-ink-muted font-sans">{label}</text>
      <view className="mt-2 flex flex-wrap gap-2">
        {FONT_STACKS.map((font) => (
          <view
            key={font.key}
            bindtap={() => onPick(font.key)}
            user-interaction-enabled={true}
            className={cn(
              "rounded-full border px-3.5 py-1.5 active:scale-95",
              active === font.key ? "border-zest bg-zest/10" : "border-rule",
            )}
          >
            <text
              style={{ fontFamily: font.stack }}
              className={cn(
                "text-sm",
                active === font.key ? "font-semibold text-ink" : "text-ink-muted",
              )}
            >
              {font.label}
            </text>
          </view>
        ))}
      </view>
    </view>
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
      <view className="mt-4 flex flex-col gap-5">
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
      </view>
    </Panel>
  );
}

/** Label + formatted read-out + reset around the Slider primitive (the src-legacy SliderRow, minus
 * the raw <input type=range>). */
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
    <view>
      <view className="flex items-baseline justify-between">
        <text className="text-xs text-ink-muted font-sans">{label}</text>
        <view className="flex items-center gap-1.5">
          <text className="text-xs text-ink-muted font-sans">{display}</text>
          {!isDefault ? (
            <view
              bindtap={onReset}
              user-interaction-enabled={true}
              className="flex h-6 w-6 items-center justify-center rounded-full active:scale-90"
            >
              <RotateCcw className="h-3 w-3 text-ink-muted" />
            </view>
          ) : null}
        </view>
      </view>
      <view className="mt-2">
        <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
      </view>
    </view>
  );
}

/* --------------------------------------------------------------- specimen */

function SpecimenPanel() {
  return (
    <Panel>
      <Eyebrow>specimen</Eyebrow>
      <text className="mt-2 block font-display text-3xl font-bold tracking-tight text-ink">
        Sphinx of quartz, judge my vow.
      </text>
      <text className="mt-1 block max-w-prose text-sm text-ink-muted font-sans">
        Body text sits like this - lists, notes, and the quiet parts of the day. The dot on the
        wordmark, progress washes and highlights all take the accent.
      </text>
      <view className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm">
          <text className="text-xs font-medium text-paper font-sans">button</text>
        </Button>
        <Button size="sm" variant="accent">
          <text className="text-xs font-medium text-paper font-sans">accent</text>
        </Button>
        <StampButton>
          <text className="text-sm font-medium text-ink font-sans">stamp</text>
        </StampButton>
        <Stamp className="border-leaf text-leaf">
          <text className="text-[9px] font-bold uppercase tracking-[0.2em] text-leaf font-sans">
            done
          </text>
        </Stamp>
        <view className="flex flex-row gap-1.5">
          {(["leaf", "zest", "sky", "clay", "honey"] as const).map((k) => (
            <view
              key={k}
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: `hsl(var(--${k}))` }}
            />
          ))}
        </view>
      </view>
    </Panel>
  );
}

/* ----------------------------------------------------------- shared bits */

/** The pill segmented control used by the palette (light/dark) + backdrop (mobile/desktop). */
function Segmented<T extends string>({
  options,
  value,
  onPick,
}: {
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <view className="flex flex-row rounded-full bg-ink/5 p-1">
      {options.map((opt) => (
        <view
          key={opt}
          bindtap={() => onPick(opt)}
          user-interaction-enabled={true}
          data-testid={`seg-${opt}`}
          className={cn(
            "rounded-full px-3.5 py-1",
            value === opt ? "bg-surface shadow-soft" : "",
          )}
        >
          <text
            className={cn(
              "text-xs font-medium capitalize font-sans",
              value === opt ? "text-ink" : "text-ink-muted",
            )}
          >
            {opt}
          </text>
        </view>
      ))}
    </view>
  );
}
