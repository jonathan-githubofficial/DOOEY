import { useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Paperclip, Plus, X } from "lucide-react";
import { Eyebrow, Panel } from "@/components/surface";
import type { PageAttach } from "./types";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** PB stores files as `<name>_<10 random chars>.<ext>` — show the human part. */
function displayName(filename: string): string {
  return filename.replace(/_\w{10}(\.\w+)$/, "$1");
}

export function AttachmentsSection({ attach }: { attach: PageAttach }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Panel className="p-5 md:p-6">
      <Eyebrow>attachments</Eyebrow>

      <ul className="mt-3 space-y-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {attach.files.map((f) => (
            <motion.li
              key={f}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="group flex items-center gap-3"
            >
              {IMAGE_EXT.test(f) ? (
                <img
                  src={attach.urlFor(f)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border border-rule/70 object-cover shadow-soft"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-rule/70 bg-paper text-ink-muted">
                  <Paperclip className="h-4 w-4" />
                </span>
              )}
              <a
                href={attach.urlFor(f)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[15px] text-ink underline-offset-2 hover:underline"
              >
                {displayName(f)}
              </a>
              <button
                type="button"
                aria-label={`Remove ${displayName(f)}`}
                onClick={() => attach.onRemove(f)}
                className="text-ink-muted/50 opacity-0 transition-[opacity,color] hover:text-clay focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={attach.busy}
        className="mt-3 flex items-center gap-2.5 text-[15px] text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
      >
        {attach.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {attach.busy ? "Uploading…" : "Attach files…"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length) attach.onAdd(picked);
          e.target.value = "";
        }}
      />
    </Panel>
  );
}
