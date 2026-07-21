import { LogOut, Moon, Sun } from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel, StampButton } from "@/components/surface";
import { GrainOverlay } from "@/components/grain-overlay";
import { useAuthStore, useThemeStore } from "@/stores";
import { signOut } from "../api";
import { AvatarDoodle } from "./AvatarDoodle";

/** The account space (unit 3.3, ported from src-legacy/features/auth/components/AccountPanel.tsx):
 * your doodled self, email, appearance and sign-out. The route guard (3.1) guarantees a session,
 * so there is no signed-out branch. Element mapping: <div>/<p>/<span> -> <view>/<text> with
 * explicit colour + font (crib "Elements"). */
export function AccountPanel() {
  const user = useAuthStore((s) => s.user);
  return (
    <Panel className="p-8 md:p-10" data-testid="account-panel">
      <Eyebrow>account</Eyebrow>
      <view className="mt-4 flex items-center gap-5">
        <AvatarDoodle />
        <view className="flex min-w-0 flex-col">
          <text className="truncate font-display text-2xl font-bold tracking-tight text-ink">
            {user?.email ?? ""}
          </text>
          {/* Neutral copy: the old "Tap the doodle to redraw yourself." promised an action that is
              disabled here (avatar editing defers to 7.3), so it is replaced per the story +
              CLAUDE.md ("no placeholder / coming-soon"). 7.3 restores the tap-to-edit + old copy. */}
          <text className="mt-0.5 text-sm text-ink-muted font-sans">Your doodled self.</text>
        </view>
      </view>
      <view className="mt-8 flex items-center justify-between border-t border-rule/50 pt-5">
        <text className="text-sm font-medium text-ink font-sans">Appearance</text>
        <ThemeToggle />
      </view>

      <view className="mt-5">
        <StampButton onClick={signOut} className="text-ink-muted">
          <LogOut className="h-4 w-4" />
          <text className="text-sm font-medium text-ink-muted font-sans">Sign out</text>
        </StampButton>
      </view>
    </Panel>
  );
}

/** A light/dark switch (state change, not a gesture): the knob slides via a CSS transform
 * transition with a spring-ish overshoot easing. The visual palette swap is unit 3.4; here the
 * toggle flips theme state (and the knob position, which reads that state).
 *
 * role="switch"/aria-checked are DOM-only (2.x defined no Lynx a11y prop mapping) -> dropped. */
function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <view
      bindtap={() => toggle()}
      user-interaction-enabled={true}
      data-testid="theme-toggle"
      className={cn(
        "relative flex h-9 w-[4.25rem] items-center rounded-full px-1 transition-colors",
        dark ? "bg-ink/30" : "bg-honey/25",
      )}
    >
      <view
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-soft transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          dark ? "translate-x-[2.1rem]" : "translate-x-0",
        )}
      >
        <GrainOverlay className="absolute inset-0 rounded-full" />
        {dark ? <Moon className="h-4 w-4 text-sky" /> : <Sun className="h-4 w-4 text-honey" />}
      </view>
    </view>
  );
}
