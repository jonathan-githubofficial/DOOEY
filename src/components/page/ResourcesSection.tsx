// A resources section (unit 4.2, ported from src-legacy/components/page/ResourcesSection.tsx onto
// Lynx): URL parsing, list, add-form, inline label edit, external open, remove.
//
// `parseResource`/`youtubeId` are ported verbatim - `new URL(...)` is available on the WEB target
// (the browser worker has the global `URL`, same class as the crib's TextDecoder note); native
// `URL` is a PARKED native-only concern. Add-field: a Lynx <input> whose `bindconfirm` (Enter)
// parses+adds (Lynx has no <form>/onSubmit); uncontrolled, so the draft rides `bindinput` and is
// cleared via setInputValue. `crypto.randomUUID()` -> `newId()` (SPEC 9).
//
// YOUTUBE EMBED - explicit degradation (SPEC): Lynx has NO <iframe> element (PLAN section 2 maps
// HTML markup to Lynx elements only). Inline playback is dropped; a `youtube` resource renders a
// tappable thumbnail card - <image src="https://i.ytimg.com/vi/<id>/hqdefault.jpg"> inside a
// <view bindtap> that calls openExternal(url), with a small play glyph overlay. This is a
// deliberate parity reduction on the web target (recorded); true inline playback would need a
// verified Lynx-web HTML-passthrough path (a STOP, not taken here).
//
// The framer springs + `lucide-react` + `group-hover` reveal are dropped as elsewhere: CSS enter
// (.animate-enter) gated on reduced-motion, the L2 icon set, always-visible remove. The old
// <a href> host link becomes a <text bindtap> calling openExternal (Lynx has no <a>).
import { useEffect, useRef, useState } from "react";

import { Link2, X } from "@/components/icons/lucide";
import type { Resource } from "@/components/page/types";
import { EditableText } from "@/components/editable";
import { Eyebrow, Panel } from "@/components/surface";
import { cn } from "@/lib/cn";
import { newId } from "@/lib/id";
import { focusInput, setInputValue, useDomId } from "@/lib/lynxInput";
import { openExternal } from "@/lib/openExternal";
import { useReducedMotion } from "@/stores";

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

function hostLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
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
  const reduced = useReducedMotion();
  const id = useDomId("resource-add");
  const draftRef = useRef("");
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    if (autoFocus) focusInput(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = () => {
    const parsed = parseResource(draftRef.current.trim());
    if (!parsed) {
      setRejected(!!draftRef.current.trim());
      return;
    }
    onChange([...resources, { id: newId(), ...parsed }]);
    draftRef.current = "";
    setInputValue(id, "");
    setRejected(false);
    focusInput(id);
  };

  return (
    <Panel className="p-5 md:p-6">
      <Eyebrow>resources</Eyebrow>

      <view className="mt-3 space-y-3">
        {resources.map((r) => (
          <view key={r.id} className={cn(!reduced && "animate-enter")} data-testid="resource-item">
            <view className="flex items-center gap-2.5">
              <Link2 className="h-4 w-4 shrink-0 text-ink-muted" />
              <EditableText
                value={r.label}
                ariaLabel={`resource "${r.label}"`}
                onCommit={(next) =>
                  onChange(resources.map((x) => (x.id === r.id ? { ...x, label: next } : x)))
                }
                className="min-w-0 flex-1 text-[15px] font-medium text-ink"
              />
              <view
                bindtap={() => openExternal(r.url)}
                accessibility-label={`Open ${hostLabel(r.url)}`}
                className="max-w-40 active:scale-95"
              >
                <text className="text-xs text-ink-muted">{hostLabel(r.url)}</text>
              </view>
              <view
                bindtap={() => onChange(resources.filter((x) => x.id !== r.id))}
                accessibility-label={`Remove "${r.label}"`}
                className="text-ink-muted/50 active:scale-90"
              >
                <X className="h-3.5 w-3.5" />
              </view>
            </view>
            {r.kind === "youtube" && <YouTubeThumb url={r.url} />}
          </view>
        ))}
      </view>

      <view className={resources.length > 0 ? "mt-4" : "mt-3"}>
        <view className="flex items-center gap-2.5 text-ink-muted">
          <Link2 className="h-4 w-4 shrink-0 text-ink-muted" />
          <input
            id={id}
            data-testid="resource-add"
            placeholder="Paste a link — YouTube opens in your browser…"
            accessibility-label="Add a resource URL"
            confirm-type="done"
            bindinput={(e: { detail: { value: string } }) => {
              draftRef.current = e.detail.value;
              if (rejected) setRejected(false);
            }}
            bindconfirm={add}
            bindblur={(e: { detail: { value: string } }) => {
              draftRef.current = e.detail.value;
            }}
            className="w-full bg-transparent text-[15px] text-ink"
          />
        </view>
        {rejected && (
          <text className="mt-1.5 pl-6 text-xs text-clay">That doesn&apos;t look like a URL.</text>
        )}
      </view>
    </Panel>
  );
}

/** The YouTube degradation: a tappable thumbnail that opens the video externally (no inline
 * <iframe> on Lynx). The play glyph is a plain overlay - icons render black on the web target
 * (unit 2.4 finding), so a text glyph avoids depending on a coloured icon here. */
function YouTubeThumb({ url }: { url: string }) {
  const yt = youtubeId(new URL(url));
  if (!yt) return null;
  return (
    <view
      bindtap={() => openExternal(url)}
      accessibility-label="Play YouTube video in your browser"
      className="relative mt-2.5 aspect-video w-full overflow-hidden rounded-xl border border-rule/70 shadow-soft active:scale-[0.99]"
    >
      <image
        src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`}
        className="h-full w-full"
        mode="aspectFill"
      />
      <view className="absolute inset-0 flex items-center justify-center">
        <view className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/70">
          <text className="text-lg text-paper">▶</text>
        </view>
      </view>
    </view>
  );
}
