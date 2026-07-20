// An attachments section (unit 4.2, ported from src-legacy/components/page/AttachmentsSection.tsx
// onto Lynx): the file LIST (image thumbnails via <image>, non-image via an icon tile),
// `displayName` cleanup, open/download (via openExternal), and remove (attach.onRemove ->
// useUpdateAttachments `field-`, already ported in api.ts).
//
// STOP-3 (file ADD) - shipped READ-ONLY: the old add path was a hidden `<input type="file">` +
// `inputRef.current.click()` producing browser `File` objects for the PB SDK. Lynx <input> has NO
// `type="file"` (supported types: text/number/digit/password/tel/email -
// lynxjs.org/api/elements/built-in/input.html) and no DOM file dialog, and whether the Lynx WEB
// host yields an SDK-uploadable `File` is UNVERIFIED. So the ADD control is present but DISABLED
// with a factual note; `attach.onAdd`/`attach.busy` (the PB `attachments+` add path) stay intact
// and untouched in the api - only the UI trigger is withheld until a Lynx-web file-picker seam is
// verified (OPEN QUESTIONS / PARKED). Do NOT fabricate a picker.
//
// The framer springs + `lucide-react` + `group-hover` reveal are dropped as elsewhere (immediate
// removal, L2 icons, always-visible remove). The old <a href> becomes a <view bindtap> calling
// openExternal (Lynx has no <a>).
import { Paperclip, X } from "@/components/icons/lucide";
import type { PageAttach } from "@/components/page/types";
import { Eyebrow, Panel } from "@/components/surface";
import { openExternal } from "@/lib/openExternal";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** PB stores files as `<name>_<10 random chars>.<ext>` — show the human part. */
function displayName(filename: string): string {
  return filename.replace(/_\w{10}(\.\w+)$/, "$1");
}

export function AttachmentsSection({ attach }: { attach: PageAttach }) {
  return (
    <Panel className="p-5 md:p-6">
      <Eyebrow>attachments</Eyebrow>

      <view className="mt-3 space-y-2">
        {attach.files.map((f) => (
          <view key={f} data-testid="attachment-item" className="flex items-center gap-3">
            {IMAGE_EXT.test(f) ? (
              <image
                src={attach.urlFor(f)}
                className="h-12 w-12 shrink-0 rounded-lg border border-rule/70 shadow-soft"
                mode="aspectFill"
              />
            ) : (
              <view className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-rule/70 bg-paper text-ink-muted">
                <Paperclip className="h-4 w-4 text-ink-muted" />
              </view>
            )}
            <view
              bindtap={() => openExternal(attach.urlFor(f))}
              accessibility-label={`Open ${displayName(f)}`}
              className="min-w-0 flex-1 active:scale-[0.99]"
            >
              <text className="text-[15px] text-ink">{displayName(f)}</text>
            </view>
            <view
              bindtap={() => attach.onRemove(f)}
              accessibility-label={`Remove ${displayName(f)}`}
              className="text-ink-muted/50 active:scale-90"
            >
              <X className="h-3.5 w-3.5" />
            </view>
          </view>
        ))}
      </view>

      {/* STOP-3: ADD disabled until a Lynx-web file-picker seam is verified. */}
      <view className="mt-3 opacity-50" user-interaction-enabled={false} data-testid="attachments-add-disabled">
        <view className="flex items-center gap-2.5">
          <Paperclip className="h-4 w-4 text-ink-muted" />
          <text className="text-[15px] text-ink-muted">Attach files…</text>
        </view>
        <text className="mt-1 pl-6 text-xs text-ink-muted/70">
          Adding files isn&apos;t available on the web target yet.
        </text>
      </view>
    </Panel>
  );
}
