import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ImagePlus, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { DoodleSvg } from "@/components/doodle-svg";
import { pointerPct, type Stroke } from "@/lib/doodle";
import { categoryByHue, categoryFor, CATEGORY_HUES } from "../categories";
import { useLearningStore } from "../store";
import { programCoverUrl } from "../api";
import {
  FOLDER_FONT_CLASS,
  type FolderFont,
  type FolderHue,
  type GeneratedProgram,
} from "../types";

/** Pens offered for doodling on a folder — includes paper for drawing on a
 * cover picture. */
const PENS = ["ink", "paper", "zest", "sky", "clay"] as const;

/**
 * Dress up a project folder: pick its color and title font, doodle straight
 * onto a live preview of the folder front, and give it a cover picture.
 * Doodle/hue/font commit on Save; the cover uploads the moment it's picked.
 */
export function FolderStudio({
  program,
  onClose,
}: {
  program: GeneratedProgram;
  onClose: () => void;
}) {
  const updateProgram = useLearningStore((s) => s.updateProgram);
  const setCover = useLearningStore((s) => s.setCover);
  const fileInput = useRef<HTMLInputElement>(null);

  const saved = program.folder ?? {};
  const inferred = categoryFor(program.goal);
  const [hue, setHue] = useState<FolderHue>(saved.hue ?? (inferred.varName.slice(2) as FolderHue));
  const [font, setFont] = useState<FolderFont>(saved.font ?? "display");
  const [doodle, setDoodle] = useState<Stroke[]>(saved.doodle ?? []);
  const [pen, setPen] = useState<(typeof PENS)[number]>("ink");
  const [liveStroke, setLiveStroke] = useState<[number, number][] | null>(null);

  const cat = categoryByHue(hue);
  const hueCss = `hsl(var(${cat.varName}))`;
  const front = `linear-gradient(160deg, color-mix(in srgb, ${hueCss} 90%, white 6%), color-mix(in srgb, ${hueCss} 84%, black 16%))`;
  const cover = program.pbId && program.cover ? programCoverUrl(program.pbId, program.cover) : null;

  const save = () => {
    updateProgram(program.id, { folder: { hue, font, doodle } });
    onClose();
  };

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-ink/30"
      />
      <motion.div
        role="dialog"
        aria-label="Customize folder"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="grain fixed left-1/2 top-1/2 z-[60] w-[21rem] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-rule/70 bg-surface p-5 shadow-soft"
      >
        <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-muted">
          customize folder
        </span>

        {/* The folder front, live — draw straight onto it. */}
        <div
          className="relative mt-3 aspect-[8/5] w-full cursor-crosshair touch-none overflow-hidden rounded-2xl shadow-soft"
          style={{ background: front }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setLiveStroke([pointerPct(e, e.currentTarget)]);
          }}
          onPointerMove={(e) => {
            if (!liveStroke) return;
            const p = pointerPct(e, e.currentTarget);
            const last = liveStroke[liveStroke.length - 1];
            if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 0.6)
              setLiveStroke([...liveStroke, p]);
          }}
          onPointerUp={() => {
            if (liveStroke && liveStroke.length > 1)
              setDoodle([...doodle, { color: pen, points: liveStroke }]);
            setLiveStroke(null);
          }}
        >
          {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {cover && (
            <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/5 to-black/40" />
          )}
          <DoodleSvg
            strokes={
              liveStroke && liveStroke.length > 1
                ? [...doodle, { color: pen, points: liveStroke }]
                : doodle
            }
            relative
            strokeWidth={2.2}
          />
          <p
            className={cn(
              "pointer-events-none absolute left-4 top-3.5 max-w-[80%] text-[16px] font-bold leading-snug text-white drop-shadow-sm line-clamp-2",
              FOLDER_FONT_CLASS[font],
            )}
          >
            {program.goal}
          </p>
        </div>

        {/* Pens + undo/clear for the doodle */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {PENS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`${c} pen`}
              onClick={() => setPen(c)}
              className={cn(
                "h-4 w-4 rounded-full border border-ink/10 transition-transform active:scale-90",
                pen === c && "ring-2 ring-ink/30 ring-offset-1 ring-offset-surface",
              )}
              style={{ backgroundColor: `hsl(var(--${c}))` }}
            />
          ))}
          <button
            type="button"
            aria-label="Undo stroke"
            disabled={doodle.length === 0}
            onClick={() => setDoodle(doodle.slice(0, -1))}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          {doodle.length > 0 && (
            <button
              type="button"
              onClick={() => setDoodle([])}
              className="text-[11px] font-medium text-ink-muted transition-colors hover:text-clay"
            >
              clear
            </button>
          )}
        </div>

        {/* Color */}
        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted">color</p>
        <div className="mt-1.5 flex gap-1.5">
          {CATEGORY_HUES.map((h) => (
            <button
              key={h}
              type="button"
              aria-label={`${h} folder`}
              onClick={() => setHue(h)}
              className={cn(
                "h-6 w-6 rounded-full transition-transform active:scale-90",
                hue === h && "ring-2 ring-ink/40 ring-offset-2 ring-offset-surface",
              )}
              style={{ backgroundColor: `hsl(var(--${h}))` }}
            />
          ))}
        </div>

        {/* Font */}
        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted">title font</p>
        <div className="mt-1.5 inset-well flex rounded-full bg-ink/5 p-1">
          {(Object.keys(FOLDER_FONT_CLASS) as FolderFont[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFont(f)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                FOLDER_FONT_CLASS[f],
                font === f ? "bg-surface text-ink shadow-soft" : "text-ink-muted hover:text-ink",
              )}
            >
              Aa
            </button>
          ))}
        </div>

        {/* Cover picture */}
        <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-ink-muted">cover picture</p>
        {program.pbId ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink"
            >
              <ImagePlus className="h-3.5 w-3.5" /> {cover ? "Replace" : "Add picture"}
            </button>
            {cover && (
              <button
                type="button"
                onClick={() => void setCover(program.id, null)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-clay"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void setCover(program.id, f);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-ink-muted">Sign in to add a cover picture.</p>
        )}

        <div className="mt-5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3.5 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-zest px-5 py-2 text-xs font-semibold text-paper shadow-soft"
          >
            Save
          </button>
        </div>
      </motion.div>
    </>
  );
}
