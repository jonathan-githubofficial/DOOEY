import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  FolderOpen,
  NotebookPen,
  Shapes,
  UserRound,
  type IconComponent,
} from "@/components/icons/lucide";
import { cn } from "@/lib/cn";
import { GrainOverlay } from "@/components/grain-overlay";
import { DoodleSvg } from "@/components/doodle-svg";
import type { Stroke } from "@/lib/doodle";
import { useStyleStore } from "@/features/style/store";
import { useAuthStore, useThemeStore } from "@/stores";

// The persistent bottom dock (unit 3.3, ported from src-legacy/components/dock.tsx onto Lynx
// elements). PORT DECISIONS (recorded in the unit result):
//  - <nav>/<div>/<Link>/<span> -> <view>/<text>; <button> -> <view bindtap>.
//  - Navigation: TanStack `<Link>` renders an `<a>`, which the Lynx web host has no element for
//    (@lynx-js/web-elements ships no `<a>`; new-tree precedent src/pages/Login.tsx navigates
//    programmatically). So each stop is a `<view bindtap>` that calls a TYPED `navigate({ to })`
//    via useNavigate() - typed against the registered route tree (compiles) and drives the
//    memory router (navigates), exactly what the old typed <Link> gave.
//  - motion/react dropped (PLAN 5.3): the route-driven active highlight is re-authored as a
//    per-stop <view> with a CSS opacity/colour transition (no layoutId, no motion lib). A true
//    positional glide of ONE highlight across variable-width stops needs runtime layout
//    measurement, which on the Lynx web worker means async cross-thread SelectorQuery (no sync
//    getBoundingClientRect); the on-device glide is PARKED per the story, so the highlight eases
//    in place on the active stop instead. The active-tab label reveal is a CSS max-width +
//    opacity transition (persistent element).
//  - Press-depress (old active:scale-95) -> kept as `active:scale-95` (native `:active`, the
//    shipped L2 Button/StampButton pattern) rather than MTS; press fidelity is PARKED and web
//    `:active` suffices. Recorded as the chosen CSS path.
//  - lucide-react glyphs -> the 2.4 hand-authored icon set (NotebookPen/CalendarDays/Shapes/
//    FolderOpen/UserRound). The 2.4 icons render black on web (recorded 2.4 gap); the `text-*`
//    classes are kept for native/future recolour. The old per-icon `strokeWidth` prop is dropped
//    (the 2.4 icon components take only `className`).
//  - aria-*/title are DOM-only (2.x defined no Lynx a11y prop mapping) -> dropped.

const spaces = [
  { to: "/", slug: "planner", label: "Planner", icon: NotebookPen, doodle: "planner" },
  { to: "/calendar", slug: "calendar", label: "Calendar", icon: CalendarDays, doodle: "calendar" },
  { to: "/boards", slug: "boards", label: "Boards", icon: Shapes, doodle: "boards" },
  { to: "/projects", slug: "projects", label: "Projects", icon: FolderOpen, doodle: "learning" },
] as const;

export function Dock() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Task + session pages are drill-ins of the planner; the style studio is a drill-in of account
  // - the parent stop stays lit there. (Active derivation ported verbatim.)
  const active = pathname.startsWith("/projects")
    ? "/projects"
    : pathname.startsWith("/calendar")
      ? "/calendar"
      : pathname.startsWith("/board")
        ? "/boards"
        : pathname.startsWith("/account") || pathname.startsWith("/style")
          ? "/account"
          : "/";

  return (
    // Safe-area: env(safe-area-inset-*) resolves on the web target (unit 2.3 note, src/lib/
    // safe-area.ts) - kept verbatim; on web without a notch it is max(1rem, 0) = 1rem. True
    // insets under a notch / home indicator are native-only and PARKED.
    <view
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
      data-testid="dock"
    >
      <view className="relative flex items-center gap-0.5 overflow-hidden rounded-full border border-rule/70 bg-surface/90 p-1 shadow-soft backdrop-blur-md">
        <GrainOverlay className="absolute inset-0 rounded-full" />
        <AccountCluster
          isActive={active === "/account"}
          onNavigate={() => navigate({ to: "/account" })}
        />
        <view className="mx-1.5 h-5 w-px bg-rule/80" />
        {spaces.map((space) => (
          <DockTab
            key={space.to}
            {...space}
            isActive={active === space.to}
            onNavigate={() => navigate({ to: space.to })}
          />
        ))}
      </view>
    </view>
  );
}

/** The active-stop highlight: an absolutely-positioned <view> that eases in on the active stop
 * (CSS opacity/colour transition; "settle, don't snap"). Non-interactive so it never eats a tap. */
function Highlight({ isActive }: { isActive: boolean }) {
  return (
    <view
      data-testid="dock-highlight"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-full ring-1 transition-opacity duration-200 ease-out",
        isActive ? "bg-zest/15 opacity-100 ring-zest/30" : "opacity-0 ring-transparent",
      )}
    />
  );
}

/** Your doodled self + the wordmark open Account; the zest full-stop is a SEPARATE sibling
 * tappable that flips the theme. Because the dot is a sibling of (not nested in) the account
 * tappable, a tap on it can never bubble into the account tap - no propagation trick needed. */
function AccountCluster({
  isActive,
  onNavigate,
}: {
  isActive: boolean;
  onNavigate: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const toggle = useThemeStore((s) => s.toggle);
  const strokes = (user?.avatar_doodle as Stroke[] | null) ?? [];
  return (
    <view className="relative flex h-10 items-center">
      <view
        bindtap={onNavigate}
        user-interaction-enabled={true}
        data-testid="dock-account"
        className="relative flex h-full items-center gap-1 rounded-full pl-1 pr-1.5 active:scale-95"
      >
        <Highlight isActive={isActive} />
        {strokes.length ? (
          <view className="relative h-8 w-8 shrink-0">
            <DoodleSvg strokes={strokes} strokeWidth={2.4} relative />
          </view>
        ) : (
          <view className="relative flex h-8 w-8 shrink-0 items-center justify-center">
            <UserRound className={cn("h-[18px] w-[18px]", isActive ? "text-ink" : "text-ink-muted")} />
          </view>
        )}
        <text className="relative select-none font-display text-[17px] font-black leading-none tracking-tight text-ink">
          DOOEY
        </text>
      </view>
      {/* The zest full-stop: flips light/dark (theme state only; the visual swap is unit 3.4). */}
      <view
        bindtap={() => toggle()}
        user-interaction-enabled={true}
        data-testid="dock-theme-dot"
        className="relative -ml-0.5 flex h-10 items-center pr-1.5 active:scale-90"
      >
        <text className="select-none font-display text-[17px] font-black leading-none text-zest">.</text>
      </view>
    </view>
  );
}

function DockTab({
  slug,
  label,
  icon: Icon,
  doodle,
  isActive,
  onNavigate,
}: {
  to: string;
  slug: string;
  label: string;
  icon: IconComponent;
  doodle: string;
  isActive: boolean;
  onNavigate: () => void;
}) {
  // A hand-drawn icon (set in Style studio, unit 3.4) replaces the stock glyph when present -
  // unless dock doodles are switched off.
  const strokes = useStyleStore((s) => (s.dockDoodles ? s.pageDoodles[doodle] : undefined));
  return (
    <view
      bindtap={onNavigate}
      user-interaction-enabled={true}
      data-testid={`dock-${slug}`}
      className="relative flex h-10 items-center rounded-full px-3 active:scale-95"
    >
      <Highlight isActive={isActive} />
      {strokes?.length ? (
        <view className="relative h-6 w-6">
          <DoodleSvg strokes={strokes} strokeWidth={2.6} relative />
        </view>
      ) : (
        <view className="relative">
          <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-ink" : "text-ink-muted")} />
        </view>
      )}
      {/* Label reveal: CSS max-width + opacity transition (auto-width is not animatable; a
          max-width larger than the longest label). Persistent element, so the transition fires. */}
      <view
        className={cn(
          "relative overflow-hidden transition-all duration-200 ease-out",
          isActive ? "max-w-[6rem] opacity-100" : "max-w-0 opacity-0",
        )}
      >
        <text
          className={cn(
            "whitespace-nowrap pl-2 pr-0.5 text-xs font-medium font-sans",
            isActive ? "text-ink" : "text-ink-muted",
          )}
        >
          {label}
        </text>
      </view>
    </view>
  );
}
