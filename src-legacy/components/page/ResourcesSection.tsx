import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link2, Plus, X } from "lucide-react";
import { Eyebrow, Panel } from "@/components/surface";
import { EditableText } from "@/components/editable";
import type { Resource } from "./types";

/** The 11-char video id, if the URL is a YouTube watch/short/embed/share link. */
function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com")
    return null;
  const v = url.searchParams.get("v");
  if (v) return v;
  const path = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);
  return path ? path[1] : null;
}

function parseResource(raw: string): Omit<Resource, "id"> | null {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
  const yt = youtubeId(url);
  if (yt) return { url: url.href, label: "YouTube video", kind: "youtube" };
  return { url: url.href, label: url.hostname.replace(/^www\./, ""), kind: "link" };
}

export function ResourcesSection({
  resources,
  onChange,
  autoFocus,
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
  autoFocus?: boolean;
}) {
  const [raw, setRaw] = useState("");
  const [rejected, setRejected] = useState(false);

  return (
    <Panel className="p-5 md:p-6">
      <Eyebrow>resources</Eyebrow>

      <ul className="mt-3 space-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {resources.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="group"
            >
              <div className="flex items-center gap-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-ink-muted" />
                <EditableText
                  value={r.label}
                  ariaLabel={`resource "${r.label}"`}
                  onCommit={(next) =>
                    onChange(resources.map((x) => (x.id === r.id ? { ...x, label: next } : x)))
                  }
                  className="min-w-0 flex-1 truncate text-[15px] font-medium"
                />
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-40 truncate text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  {new URL(r.url).hostname.replace(/^www\./, "")}
                </a>
                <button
                  type="button"
                  aria-label={`Remove "${r.label}"`}
                  onClick={() => onChange(resources.filter((x) => x.id !== r.id))}
                  className="text-ink-muted/50 opacity-0 transition-[opacity,color] hover:text-clay focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {r.kind === "youtube" && <YouTubeEmbed url={r.url} title={r.label} />}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseResource(raw.trim());
          if (!parsed) {
            setRejected(!!raw.trim());
            return;
          }
          onChange([...resources, { id: crypto.randomUUID(), ...parsed }]);
          setRaw("");
          setRejected(false);
        }}
        className={resources.length > 0 ? "mt-4" : "mt-3"}
      >
        <div className="flex items-center gap-2.5 text-ink-muted">
          <Plus className="h-4 w-4 shrink-0" />
          <input
            value={raw}
            autoFocus={autoFocus}
            onChange={(e) => {
              setRaw(e.target.value);
              setRejected(false);
            }}
            placeholder="Paste a link — YouTube plays right here…"
            aria-label="Add a resource URL"
            enterKeyHint="done"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted/60"
          />
        </div>
        {rejected && (
          <p className="mt-1.5 pl-6 text-xs text-clay">That doesn&apos;t look like a URL.</p>
        )}
      </form>
    </Panel>
  );
}

function YouTubeEmbed({ url, title }: { url: string; title: string }) {
  const id = youtubeId(new URL(url));
  if (!id) return null;
  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-rule/70 shadow-soft">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full"
      />
    </div>
  );
}
