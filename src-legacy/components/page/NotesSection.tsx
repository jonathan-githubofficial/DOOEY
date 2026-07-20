import { useEffect, useRef, useState } from "react";
import { Eyebrow, Panel } from "@/components/surface";

/** Free-text notes with quiet autosave: debounced while typing, flushed on blur. */
export function NotesSection({
  notes,
  onSave,
  autoFocus,
}: {
  notes: string;
  onSave: (notes: string) => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(notes);
  const timer = useRef<number>(undefined);
  const latest = useRef({ draft, notes, onSave });
  useEffect(() => {
    latest.current = { draft, notes, onSave };
  });

  const save = () => {
    window.clearTimeout(timer.current);
    const { draft, notes, onSave } = latest.current;
    if (draft !== notes) onSave(draft);
  };

  // Flush a pending edit if the page unmounts mid-debounce.
  useEffect(() => {
    const flush = save;
    return () => flush();
  }, []);

  return (
    <Panel className="p-5 md:p-6">
      <Eyebrow>notes</Eyebrow>
      <textarea
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => {
          setDraft(e.target.value);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(save, 800);
        }}
        onBlur={save}
        placeholder="Anything worth remembering…"
        aria-label="Task notes"
        rows={Math.max(3, draft.split("\n").length)}
        className="relative mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-muted/60"
      />
    </Panel>
  );
}
