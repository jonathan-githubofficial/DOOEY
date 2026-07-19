import { Link, useRouterState } from "@tanstack/react-router";
import { NotebookPen, CalendarDays, FolderOpen, Shapes, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { DoodleSvg } from "@/components/doodle-svg";
import type { Stroke } from "@/lib/doodle";
import { useStyleStore } from "@/features/style";
import { useAuthStore, useThemeStore } from "@/stores";

const spaces = [
  { to: "/", label: "Planner", icon: NotebookPen, doodle: "planner" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, doodle: "calendar" },
  { to: "/boards", label: "Boards", icon: Shapes, doodle: "boards" },
  { to: "/projects", label: "Projects", icon: FolderOpen, doodle: "learning" },
] as const;

/** The dock: the wordmark anchors the left end (its zest full-stop toggles
 * light/dark), your doodled self beside it is the door to Account, and the
 * space tabs follow. The highlight glides between stops on a spring. */
export function Dock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Task + session pages are drill-ins of the planner, and the style studio is
  // a drill-in of account — the parent stop stays lit there.
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
    <nav
      aria-label="Spaces"
      className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grain flex items-center gap-0.5 rounded-full border border-rule/70 bg-surface/90 p-1 shadow-soft backdrop-blur-md">
        <AccountCluster isActive={active === "/account"} />
        <span className="mx-1.5 h-5 w-px bg-rule/80" aria-hidden />
        {spaces.map((space) => (
          <DockTab key={space.to} {...space} isActive={active === space.to} />
        ))}
      </div>
    </nav>
  );
}

/** Your doodled self and the wordmark, one piece: tap anywhere on it to open
 * Account. Only the zest full-stop does something else — it flips the theme. */
function AccountCluster({ isActive }: { isActive: boolean }) {
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const strokes = (user?.avatar_doodle as Stroke[] | null) ?? [];
  return (
    <Link
      to="/account"
      aria-label="Account"
      aria-current={isActive ? "page" : undefined}
      title="Account"
      className="relative flex h-10 items-center gap-1 rounded-full pl-1 pr-2.5 transition-transform active:scale-95"
    >
      {isActive && (
        <motion.span
          layoutId="dock-active"
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
          className="absolute inset-0 rounded-full bg-zest/15 ring-1 ring-zest/30"
        />
      )}
      {strokes.length ? (
        <span className="relative h-8 w-8 shrink-0">
          <DoodleSvg strokes={strokes} strokeWidth={2.4} relative />
        </span>
      ) : (
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <UserRound
            className={cn("h-[18px] w-[18px]", isActive ? "text-ink" : "text-ink-muted")}
            strokeWidth={isActive ? 2.2 : 1.8}
          />
        </span>
      )}
      <span className="relative select-none font-display text-[17px] font-black leading-none tracking-tight text-ink">
        DOOEY
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title="Toggle light / dark"
          className="text-zest transition-[opacity,transform] hover:opacity-70 active:scale-75"
        >
          .
        </button>
      </span>
    </Link>
  );
}

function DockTab({
  to,
  label,
  icon: Icon,
  doodle,
  isActive,
}: {
  to: string;
  label: string;
  icon: typeof NotebookPen;
  doodle: string;
  isActive: boolean;
}) {
  // A hand-drawn icon (set in Style studio) replaces the stock glyph when present
  // — unless doodle icons are switched off in the dock.
  const strokes = useStyleStore((s) => (s.dockDoodles ? s.pageDoodles[doodle] : undefined));
  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-10 items-center rounded-full px-3 transition-[color,transform] active:scale-95",
        isActive ? "text-ink" : "text-ink-muted hover:text-ink",
      )}
    >
      {isActive && (
        <motion.span
          layoutId="dock-active"
          transition={{ type: "spring", stiffness: 480, damping: 34 }}
          className="absolute inset-0 rounded-full bg-zest/15 ring-1 ring-zest/30"
        />
      )}
      {strokes?.length ? (
        <span className="relative h-6 w-6">
          <DoodleSvg strokes={strokes} strokeWidth={2.6} relative />
        </span>
      ) : (
        <Icon className="relative h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
      )}
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.span
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative overflow-hidden whitespace-nowrap text-xs font-medium"
          >
            <span className="pl-2 pr-0.5">{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
