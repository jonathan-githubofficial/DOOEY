import { Link } from "@tanstack/react-router";
import { ChevronRight, Palette } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { Panel } from "@/components/surface";
import { AccountPanel } from "@/features/auth";
import { PageDoodle } from "@/features/style";

export function Account() {
  return (
    <>
      <Masthead avatar={<PageDoodle page="account" />} title="Account" />
      {/* Above the style-studio card, so the doodle editor popover never gets
          buried under the sibling panel's stacking context. */}
      <div className="relative z-10 mt-8">
        <AccountPanel />
      </div>
      <Link to="/style" className="mt-4 block">
        <Panel className="flex items-center gap-4 p-5 transition-transform active:scale-[0.99] md:p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zest/15 text-zest">
            <Palette className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold tracking-tight text-ink">
              Style studio
            </span>
            <span className="block text-sm text-ink-muted">
              Colours, fonts, corners &amp; grain — make DOOEY yours.
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
        </Panel>
      </Link>
    </>
  );
}
