// The structured body every page shares (unit 4.2, ported from
// src-legacy/components/page/PageSections.tsx onto Lynx): notes, checklist, resources, and - when
// the page can store files - attachments. The `opened` Set logic, visibility rules
// (content-bearing sections always show; opened ones show this visit), and the dashed
// add-affordance dots are ported unchanged. The `<button>` dots become `<view bindtap>` with an L2
// icon and an `active:scale-90` press (the uiVariants `:active`-equivalent, matching the L2
// StampButton/Slider). `lucide-react` -> the L2 icon set. `group-hover` had no dot here.
import { useState } from "react";

import { Link2, ListChecks, Paperclip, StickyNote } from "@/components/icons/lucide";
import type { ChecklistItem, PageAttach, Resource } from "@/components/page/types";
import { NotesSection } from "@/components/page/NotesSection";
import { ChecklistSection } from "@/components/page/ChecklistSection";
import { ResourcesSection } from "@/components/page/ResourcesSection";
import { AttachmentsSection } from "@/components/page/AttachmentsSection";

type SectionKey = "notes" | "checklist" | "resources" | "attachments";

type IconComponent = (props: { className?: string }) => JSX.Element;

const sectionMeta: { key: SectionKey; label: string; icon: IconComponent }[] = [
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "resources", label: "Resources", icon: Link2 },
  { key: "attachments", label: "Attachments", icon: Paperclip },
];

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
  onPatch: (patch: {
    notes?: string;
    checklist?: ChecklistItem[];
    resources?: Resource[];
  }) => void;
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
        <view className="flex gap-1.5 px-1 pt-1">
          {missing.map(({ key, label, icon: Icon }) => (
            <view
              key={key}
              bindtap={() => setOpened((s) => new Set(s).add(key))}
              accessibility-label={`Add ${label.toLowerCase()}`}
              data-testid={`add-${key}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-rule/80 text-ink-muted/60 active:scale-90"
            >
              <Icon className="h-3.5 w-3.5" />
            </view>
          ))}
        </view>
      )}
    </>
  );
}
