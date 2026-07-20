// Free-text notes with quiet autosave (unit 4.2, ported from
// src-legacy/components/page/NotesSection.tsx onto Lynx): debounced while typing, flushed on
// blur/confirm, flushed on unmount. The debounce/flush logic is ported verbatim (timers exist in
// Lynx: bare setTimeout/clearTimeout, no `window` per R11).
//
// ELEMENT CHOICE - single-line <input>, not <textarea> (verified web-target limitation, recorded
// parity gap): the story SPEC directed a multi-line Lynx <textarea>, but on the pinned web runtime
// (@lynx-js/web-core 0.22.2) the `textarea` Lynx tag is NOT in `LYNX_TAG_TO_HTML_TAG_MAP`
// (dist/constants.js: only `input -> x-input`), so a `<textarea>` renders as a RAW native
// <textarea> with NO event teleport - `bindinput`/`bindblur` never reach the app (proven in this
// unit's e2e bring-up: fill set the DOM value but no handler fired; the element's host chain was
// `textarea<lynx-view`, i.e. not wrapped by the registered `x-textarea`). The framework crib's
// blessed element list likewise omits `<textarea>` (only `<input>`). So Notes uses the working
// Lynx <input> (x-input) with a generous maxlength; multi-line entry is a PARKED parity gap until
// web-core routes `textarea` (or a native host does). Everything else (autosave, persistence,
// reload rehydration) is unchanged.
//
// <input> is uncontrolled (no `value` prop), so the current notes are filled imperatively via
// setInputValue and the draft is read from `bindinput`'s event.detail.value (NOT React onChange).
// `autoFocus` -> imperative focus on mount when the section was just opened.
import { useEffect, useRef } from "react";

import { Eyebrow, Panel } from "@/components/surface";
import { focusInput, setInputValue, useDomId } from "@/lib/lynxInput";

export function NotesSection({
  notes,
  onSave,
  autoFocus,
}: {
  notes: string;
  onSave: (notes: string) => void;
  autoFocus?: boolean;
}) {
  const id = useDomId("notes");
  const draftRef = useRef(notes);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ notes, onSave });
  useEffect(() => {
    latest.current = { notes, onSave };
  });

  const save = () => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    const { notes, onSave } = latest.current;
    if (draftRef.current !== notes) onSave(draftRef.current);
  };

  // Fill the value-less Lynx <input> on mount + when `notes` changes externally (the reload
  // rehydration path: the task loads with saved notes and this must display them).
  useEffect(() => {
    draftRef.current = notes;
    setInputValue(id, notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // autoFocus (only when the section was just opened): focus imperatively (Lynx has no autoFocus).
  useEffect(() => {
    if (autoFocus) focusInput(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush a pending edit if the page unmounts mid-debounce.
  useEffect(() => {
    return () => save();
  }, []);

  return (
    <Panel className="p-5 md:p-6">
      <Eyebrow>notes</Eyebrow>
      <input
        id={id}
        data-testid="task-notes-input"
        maxlength={2000}
        placeholder="Anything worth remembering…"
        accessibility-label="Task notes"
        bindinput={(e: { detail: { value: string } }) => {
          draftRef.current = e.detail.value;
          if (timer.current !== undefined) clearTimeout(timer.current);
          timer.current = setTimeout(save, 800);
        }}
        bindblur={(e: { detail: { value: string } }) => {
          // The blur event carries the final value too (web-elements teleport it), so capture it
          // before flushing - robust even if the last bindinput was coalesced.
          draftRef.current = e.detail.value;
          save();
        }}
        bindconfirm={(e: { detail: { value: string } }) => {
          draftRef.current = e.detail.value;
          save();
        }}
        className="mt-2 w-full bg-transparent text-[15px] leading-relaxed text-ink"
      />
    </Panel>
  );
}
