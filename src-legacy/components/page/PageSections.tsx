import { useState } from "react";
import { Link2, ListChecks, Paperclip, StickyNote } from "lucide-react";
import { NotesSection } from "./NotesSection";
import { ChecklistSection } from "./ChecklistSection";
import { ResourcesSection } from "./ResourcesSection";
import { AttachmentsSection } from "./AttachmentsSection";
import type { ChecklistItem, PageAttach, Resource } from "./types";

type SectionKey = "notes" | "checklist" | "resources" | "attachments";

const sectionMeta: { key: SectionKey; label: string; icon: typeof StickyNote }[] = [
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "resources", label: "Resources", icon: Link2 },
  { key: "attachments", label: "Attachments", icon: Paperclip },
];

/** The structured body every page shares: notes, checklist, resources, and —
 * when the page can store files — attachments. Empty sections hide behind
 * dashed add-affordances. */
export function PageSections({
  notes,
  checklist,
  resources,
  onPatch,
  attach,
}: {
  notes: string;
  checklist: ChecklistItem[];
  resources: Resource[];
  onPatch: (patch: { notes?: string; checklist?: ChecklistItem[]; resources?: Resource[] }) => void;
  attach?: PageAttach;
}) {
  // Sections the user opened this visit; content-bearing ones show regardless.
  const [opened, setOpened] = useState<Set<SectionKey>>(new Set());

  const visible: Record<SectionKey, boolean> = {
    notes: !!notes || opened.has("notes"),
    checklist: checklist.length > 0 || opened.has("checklist"),
    resources: resources.length > 0 || opened.has("resources"),
    attachments: !!attach && (attach.files.length > 0 || opened.has("attachments")),
  };
  const missing = sectionMeta.filter(({ key }) => {
    if (visible[key]) return false;
    if (key === "attachments") return !!attach;
    return true;
  });

  return (
    <>
      {visible.notes && (
        <NotesSection
          notes={notes}
          autoFocus={opened.has("notes") && !notes}
          onSave={(next) => onPatch({ notes: next })}
        />
      )}
      {visible.checklist && (
        <ChecklistSection
          items={checklist}
          autoFocus={opened.has("checklist") && checklist.length === 0}
          onChange={(next) => onPatch({ checklist: next })}
        />
      )}
      {visible.resources && (
        <ResourcesSection
          resources={resources}
          autoFocus={opened.has("resources") && resources.length === 0}
          onChange={(next) => onPatch({ resources: next })}
        />
      )}
      {visible.attachments && attach && <AttachmentsSection attach={attach} />}

      {missing.length > 0 && (
        <div className="flex gap-1.5 px-1 pt-1">
          {missing.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-label={`Add ${label.toLowerCase()}`}
              title={label}
              onClick={() => setOpened((s) => new Set(s).add(key))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-rule/80 text-ink-muted/60 transition-[color,border-color,transform] hover:border-ink hover:text-ink active:scale-90"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
