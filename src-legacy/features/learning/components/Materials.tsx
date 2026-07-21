import { Download } from "lucide-react";
import { Panel, Eyebrow } from "@/components/surface";
import { Markdown } from "../Markdown";
import type { GeneratedProgram } from "../types";

const DOC_ORDER = ["PLAN.md", "TESTS.md", "DAILY-TEMPLATE.md", "LOG.md"] as const;
const DOC_LABELS: Record<string, string> = {
  "PLAN.md": "The plan",
  "TESTS.md": "Gates & tests",
  "DAILY-TEMPLATE.md": "Daily session",
  "LOG.md": "Progress log",
};

/** Reference material card: calendar file plus the skill's prose docs as disclosures. */
export function Materials({ program }: { program: GeneratedProgram }) {
  const docs = DOC_ORDER.filter((name) => program.files[name]);
  const hasCalendar = !!program.files["calendar.ics"];
  if (docs.length === 0 && !hasCalendar) return null;

  return (
    <Panel>
      <Eyebrow>materials</Eyebrow>
      <div className="mt-3">
        {hasCalendar && (
          <button
            onClick={() => downloadIcs(program)}
            className="flex w-full items-center gap-2 border-t border-rule/50 py-3 text-left text-[15px] text-ink-muted transition-colors first:border-t-0 hover:text-ink"
          >
            <Download className="h-4 w-4" /> Download calendar (.ics)
          </button>
        )}
        {docs.map((name) => (
          <details key={name} className="group border-t border-rule/50 py-3 first:border-t-0">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-medium text-ink transition-colors hover:text-ink-muted">
              {DOC_LABELS[name]}
              <span className="text-ink-muted/60 group-open:hidden">+</span>
              <span className="hidden text-ink-muted/60 group-open:inline">−</span>
            </summary>
            <div className="mt-4 pb-1">
              <Markdown source={program.files[name]} />
            </div>
          </details>
        ))}
      </div>
    </Panel>
  );
}

function downloadIcs(program: GeneratedProgram) {
  const blob = new Blob([program.files["calendar.ics"]], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(program.goal)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "program";
}
