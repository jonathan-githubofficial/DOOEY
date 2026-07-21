import { useRef } from "react";
import { motion } from "motion/react";
import { Plus, Upload } from "lucide-react";
import { StampButton } from "@/components/surface";
import { useLearningStore } from "../store";
import type { ProgramFiles } from "../types";

/**
 * Import a program the skill produced: run learning-architect in Claude, then drop
 * the PLAN.md / SCHEDULE.md / TESTS.md / calendar.ics bundle in here.
 */
export function ImportButton({ variant = "pill" }: { variant?: "pill" | "card" }) {
  const importProgram = useLearningStore((s) => s.importProgram);
  const ref = useRef<HTMLInputElement>(null);

  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files: ProgramFiles = {};
    for (const file of Array.from(list)) files[file.name] = await file.text();
    await importProgram(files);
    if (ref.current) ref.current.value = "";
  };

  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept=".md,.ics,.txt"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {variant === "card" ? (
        <motion.button
          type="button"
          onClick={() => ref.current?.click()}
          initial="rest"
          whileHover="hover"
          whileTap={{ scale: 0.98 }}
          className="group flex aspect-[8/7] w-full flex-col items-center justify-center gap-2.5 rounded-[var(--radius-card)] border-2 border-dashed border-rule px-2 text-center text-ink-muted transition-colors hover:border-ink hover:text-ink"
        >
          <motion.span
            variants={{ rest: { rotate: 0 }, hover: { rotate: 90 } }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-ink/5"
          >
            <Plus className="h-5 w-5" />
          </motion.span>
          <span className="text-xs font-medium leading-tight">Import a skill bundle</span>
        </motion.button>
      ) : (
        <StampButton type="button" onClick={() => ref.current?.click()}>
          <Upload className="h-4 w-4" /> Import
        </StampButton>
      )}
    </>
  );
}
