import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Paintbrush } from "lucide-react";
import { cn } from "@/lib/cn";
import { DoodleSvg } from "@/components/doodle-svg";
import { FolderShell } from "@/components/icons/folder-shell";
import { useProjectTasks } from "@/features/tasks";
import { categoryByHue, categoryFor } from "../categories";
import { projectStat, relDay } from "../metrics";
import { programCoverUrl } from "../api";
import { FOLDER_FONT_CLASS, type GeneratedProgram } from "../types";
import { FolderStudio } from "./FolderStudio";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * A project as a real folder: a deep-hue shell with a contoured tab, papers
 * peeking out of its mouth (they lift when you hover), and a saturated front
 * panel carrying the title, progress and any dress-up the owner applied —
 * cover picture, doodles, hand-picked color and font.
 */
export function FolderCard({
  program,
  onOpen,
}: {
  program: GeneratedProgram;
  onOpen: () => void;
}) {
  const { data: tasks } = useProjectTasks(program.pbId);
  const [studio, setStudio] = useState(false);
  const style = program.folder ?? {};
  const cat = style.hue ? categoryByHue(style.hue) : categoryFor(program.goal);
  const m = projectStat(tasks ?? []);
  const complete = m.total > 0 && m.done === m.total;

  const hue = `hsl(var(${cat.varName}))`;
  const deep = `color-mix(in srgb, ${hue} 72%, black 28%)`;
  const front = `linear-gradient(160deg, color-mix(in srgb, ${hue} 90%, white 6%), color-mix(in srgb, ${hue} 84%, black 16%))`;
  const fontClass = FOLDER_FONT_CLASS[style.font ?? "display"];
  const cover = program.pbId && program.cover ? programCoverUrl(program.pbId, program.cover) : null;

  return (
    <>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={program.goal}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        initial="rest"
        animate="rest"
        whileHover="lift"
        whileTap={{ scale: 0.985 }}
        className="group relative block aspect-[8/7] w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-zest/60"
      >
        {/* Folder shell — the tab contour */}
        <FolderShell
          fill={deep}
          className="absolute inset-0 h-full w-full drop-shadow-[0_2px_3px_rgb(40_32_24/0.18)]"
        />

        {/* Papers peeking out of the mouth — they rise when the folder is hovered. */}
        <motion.span
          aria-hidden
          variants={{ rest: { y: 0, rotate: -2 }, lift: { y: -10, rotate: -4 } }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="absolute left-[9%] top-[7%] h-[24%] w-[40%] rounded-t-md bg-white p-2 shadow-md"
        >
          <span className="block h-px w-3/4 bg-black/10" />
          <span className="mt-1.5 block truncate text-[8px] font-medium leading-tight text-black/45">
            {m.next?.title ?? "done ✓"}
          </span>
        </motion.span>
        <motion.span
          aria-hidden
          variants={{ rest: { y: 3, rotate: 2 }, lift: { y: -6, rotate: 5 } }}
          transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.03 }}
          className="absolute right-[12%] top-[9%] h-[20%] w-[30%] rounded-t-md bg-white/95 p-2 shadow-md"
        >
          <span className="block h-px w-2/3 bg-black/10" />
          <span className="mt-1 block h-px w-1/2 bg-black/10" />
        </motion.span>

        {/* Front panel */}
        <div
          className="absolute inset-x-0 bottom-0 top-[19%] overflow-hidden rounded-[20px]"
          style={{ background: front }}
        >
          {cover && (
            <>
              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/5 to-black/45"
              />
            </>
          )}
          {style.doodle && style.doodle.length > 0 && (
            <DoodleSvg strokes={style.doodle} relative strokeWidth={2.2} />
          )}

          <div className="absolute inset-x-0 top-0 p-3 pr-10">
            <p
              className={cn(
                "text-[14px] font-bold leading-snug text-white drop-shadow-sm line-clamp-2",
                fontClass,
              )}
            >
              {program.goal}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-white/75">{m.total} sessions</p>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 pb-2.5">
            <span className="font-display text-xl font-bold tabular-nums text-white drop-shadow-sm">
              {pad2(m.done)}
              <span className="text-[13px] font-medium text-white/70"> / {m.total}</span>
            </span>
            <span className="text-[13px] font-semibold text-white/90 drop-shadow-sm">
              {complete ? "complete" : m.next?.dateObj ? relDay(m.next.dateObj) : m.next ? "next up" : ""}
            </span>
          </div>

          {/* Slim progress along the very bottom edge */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
            <div className="h-full bg-white/85" style={{ width: `${m.pct}%` }} />
          </div>
        </div>

        {/* Dress-up entry — kept out of the card's click */}
        <button
          type="button"
          aria-label="Customize folder"
          onClick={(e) => {
            e.stopPropagation();
            setStudio(true);
          }}
          className="absolute right-3 top-[24%] z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Paintbrush className="h-4 w-4" />
        </button>
      </motion.div>

      <AnimatePresence>
        {studio && <FolderStudio program={program} onClose={() => setStudio(false)} />}
      </AnimatePresence>
    </>
  );
}
