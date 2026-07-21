import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Palette } from "@/components/icons/lucide";
import { Masthead } from "@/components/masthead";
import { Panel } from "@/components/surface";
import { AccountPanel } from "@/features/auth";

/** The Account space (unit 3.3, ported from src-legacy/pages/Account.tsx).
 *
 * Masthead avatar: the old header wore `<PageDoodle page="account" />` from @/features/style,
 * which unit 3.4 builds. To keep 3.3 self-contained (story SPEC 8), the avatar is omitted here
 * and the account page-doodle DEFERS to 3.4 (recorded). Navigation to the style studio uses a
 * typed navigate({ to: "/style" }) on a <view bindtap> (TanStack <Link> renders an unsupported
 * <a> - see dock.tsx); "/style" is a registered interim route (unit 3.4 replaces it). */
export function Account() {
  const navigate = useNavigate();
  return (
    <view data-testid="page-account">
      <Masthead title="Account" />
      {/* Above the style-studio card so the (future 7.3) avatar editor popover is never buried. */}
      <view className="relative z-10 mt-8">
        <AccountPanel />
      </view>
      <view
        bindtap={() => navigate({ to: "/style" })}
        user-interaction-enabled={true}
        data-testid="account-style-link"
        className="mt-4 active:scale-[0.99]"
      >
        <Panel className="flex items-center gap-4 p-5 md:p-5">
          <view className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zest/15">
            <Palette className="h-5 w-5 text-zest" />
          </view>
          <view className="flex min-w-0 flex-1 flex-col">
            <text className="font-display text-lg font-bold tracking-tight text-ink">
              Style studio
            </text>
            <text className="text-sm text-ink-muted font-sans">
              Colours, fonts, corners &amp; grain — make DOOEY yours.
            </text>
          </view>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
        </Panel>
      </view>
    </view>
  );
}
