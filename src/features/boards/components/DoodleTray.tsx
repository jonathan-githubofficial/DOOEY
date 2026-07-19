import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { INK_COLORS, pointerPct, strokePath, type InkColor, type Stroke } from "@/lib/doodle";
import { normalizeDoodle, useCreatePack, useDeletePack, useDoodlePacks, useUpdatePack } from "../packs";
import type { DoodlePack, PackDoodle } from "../types";
import { DoodleGlyph } from "./DoodleGlyph";

/** The doodle-pack popover: your saved doodles by pack — tap one to stamp it
 * onto the board, or draw a new one right here. Packs live on the account, so
 * every board (and, later, other people) can use them. */
export function DoodleTray({
  onPlace,
  onClose,
}: {
  onPlace: (d: Pick<PackDoodle, "strokes" | "aspect">) => void;
  onClose: () => void;
}) {
  const { data: packs } = useDoodlePacks();
  const createPack = useCreatePack();
  const updatePack = useUpdatePack();
  const deletePack = useDeletePack();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [newPack, setNewPack] = useState<string | null>(null);

  const active: DoodlePack | undefined =
    packs?.find((p) => p.id === activeId) ?? packs?.[0];

  if (drawing)
    return (
      <DoodleStudio
        packs={packs ?? []}
        defaultPackId={active?.id}
        onCancel={() => setDrawing(false)}
        onSave={(packId, packTitle, doodle) => {
          const place = () => onPlace(doodle);
          if (packId) {
            const pack = packs?.find((p) => p.id === packId);
            if (pack) updatePack.mutate({ id: pack.id, doodles: [...pack.doodles, doodle] });
            place();
          } else {
            createPack.mutate(packTitle || "My doodles", {
              onSuccess: (r) => {
                updatePack.mutate({ id: r.id, doodles: [doodle] });
                setActiveId(r.id);
              },
            });
            place();
          }
          setDrawing(false);
        }}
      />
    );

  return (
    <div className="w-72">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">doodle packs</span>
        <button
          type="button"
          aria-label={managing ? "Done managing" : "Manage packs"}
          onClick={() => setManaging((m) => !m)}
          className={cn(
            "ml-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            managing ? "bg-zest/15 text-zest" : "text-ink-muted hover:text-ink",
          )}
        >
          {managing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Pack tabs */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {packs?.map((p) => (
          <span key={p.id} className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveId(p.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                active?.id === p.id ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
              )}
            >
              {p.title}
            </button>
            {managing && (
              <button
                type="button"
                aria-label={`Delete pack ${p.title}`}
                onClick={() => deletePack.mutate(p.id)}
                className="-ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-clay"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {newPack === null ? (
          <button
            type="button"
            onClick={() => setNewPack("")}
            className="flex items-center gap-0.5 rounded-full border border-dashed border-rule px-2 py-1 text-xs text-ink-muted transition-colors hover:border-ink hover:text-ink"
          >
            <Plus className="h-3 w-3" /> pack
          </button>
        ) : (
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              const title = newPack.trim();
              if (title)
                createPack.mutate(title, { onSuccess: (r) => setActiveId(r.id) });
              setNewPack(null);
            }}
          >
            <input
              autoFocus
              value={newPack}
              onChange={(e) => setNewPack(e.target.value)}
              onBlur={() => setNewPack(null)}
              placeholder="Pack name…"
              aria-label="New pack name"
              className="w-24 rounded-full border border-rule bg-paper/60 px-2.5 py-1 text-xs text-ink outline-none"
            />
          </form>
        )}
      </div>

      {/* Doodles */}
      <div className="mt-2.5 grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto">
        <button
          type="button"
          onClick={() => setDrawing(true)}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-rule text-ink-muted transition-colors hover:border-ink hover:text-ink"
        >
          <Pencil className="h-4 w-4" />
          <span className="text-[9px] font-medium uppercase tracking-[0.1em]">new</span>
        </button>
        {active?.doodles.map((d) => (
          <span key={d.id} className="relative">
            <button
              type="button"
              title={d.name || "Place doodle"}
              onClick={() => onPlace(d)}
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-ink/[0.04] p-1.5 transition-[background-color,transform] hover:bg-ink/[0.08] active:scale-95"
            >
              <DoodleGlyph strokes={d.strokes} aspect={d.aspect} width={d.aspect < 1 ? 44 * d.aspect : 44} />
            </button>
            {managing && active && (
              <button
                type="button"
                aria-label="Delete doodle"
                onClick={() =>
                  updatePack.mutate({
                    id: active.id,
                    doodles: active.doodles.filter((x) => x.id !== d.id),
                  })
                }
                className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-rule bg-surface text-ink-muted shadow-soft hover:text-clay"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        {active && active.doodles.length === 0 && (
          <p className="col-span-3 self-center text-xs text-ink-muted">
            Nothing here yet — draw one.
          </p>
        )}
        {!packs?.length && (
          <p className="col-span-3 self-center text-xs text-ink-muted">
            Draw a doodle to start your first pack.
          </p>
        )}
      </div>
    </div>
  );
}

/** A small drawing pad: sketch, pick a pack (or name a new one), save. The
 * saved doodle lands in the pack and on the board in one go. */
function DoodleStudio({
  packs,
  defaultPackId,
  onSave,
  onCancel,
}: {
  packs: DoodlePack[];
  defaultPackId?: string;
  onSave: (packId: string | null, newPackTitle: string, doodle: PackDoodle) => void;
  onCancel: () => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [liveStroke, setLiveStroke] = useState<[number, number][] | null>(null);
  const [ink, setInk] = useState<InkColor>("ink");
  const [name, setName] = useState("");
  const [packId, setPackId] = useState<string | null>(defaultPackId ?? null);
  const [newTitle, setNewTitle] = useState("");

  const save = () => {
    if (strokes.length === 0) return;
    const norm = normalizeDoodle(strokes);
    onSave(packId, newTitle, {
      id: crypto.randomUUID(),
      name: name.trim(),
      strokes: norm.strokes,
      aspect: norm.aspect,
    });
  };

  return (
    <div className="w-72">
      <div className="flex items-center">
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">new doodle</span>
        <button
          type="button"
          aria-label="Back"
          onClick={onCancel}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div
        ref={padRef}
        className="mt-2 aspect-square w-full cursor-crosshair touch-none rounded-2xl border border-rule/70 bg-paper/70"
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
            setStrokes([...strokes, { color: ink, points: liveStroke }]);
          setLiveStroke(null);
        }}
      >
        <svg aria-hidden viewBox="0 0 100 100" className="h-full w-full">
          {[...strokes, ...(liveStroke && liveStroke.length > 1 ? [{ color: ink, points: liveStroke }] : [])].map(
            (s, i) => (
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
            ),
          )}
        </svg>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {INK_COLORS.map((c) => (
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
        ))}
        <button
          type="button"
          aria-label="Undo stroke"
          disabled={strokes.length === 0}
          onClick={() => setStrokes(strokes.slice(0, -1))}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional)"
        aria-label="Doodle name"
        className="mt-2 w-full rounded-lg border border-rule/60 bg-paper/60 px-2.5 py-1.5 text-xs text-ink outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {packs.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPackId(p.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              packId === p.id ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
            )}
          >
            {p.title}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPackId(null)}
          className={cn(
            "rounded-full border border-dashed px-2.5 py-1 text-xs font-medium transition-colors",
            packId === null ? "border-ink text-ink" : "border-rule text-ink-muted hover:text-ink",
          )}
        >
          + new pack
        </button>
        {packId === null && (
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Pack name…"
            aria-label="New pack name"
            className="w-24 rounded-full border border-rule bg-paper/60 px-2.5 py-1 text-xs text-ink outline-none"
          />
        )}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={strokes.length === 0}
        onClick={save}
        className="mt-3 w-full rounded-full bg-zest py-2 text-xs font-semibold text-paper shadow-soft disabled:opacity-40"
      >
        Save & place
      </motion.button>
    </div>
  );
}
