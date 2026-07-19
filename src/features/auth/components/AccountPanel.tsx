import { LogOut, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { Eyebrow, Panel, StampButton } from "@/components/surface";
import { useAuthStore, useThemeStore } from "@/stores";
import { signOut } from "../api";
import { AvatarDoodle } from "./AvatarDoodle";

/** The account space: your doodled self, email, appearance and sign-out.
 * The route guard guarantees a session, so there's no signed-out branch. */
export function AccountPanel() {
  const user = useAuthStore((s) => s.user);
  return (
    <Panel className="p-8 md:p-10">
      <Eyebrow>account</Eyebrow>
      <div className="mt-4 flex items-center gap-5">
        <AvatarDoodle />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-bold tracking-tight text-ink">
            {user?.email}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Tap the doodle to redraw yourself.
          </p>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between border-t border-rule/50 pt-5">
        <span className="text-sm font-medium text-ink">Appearance</span>
        <ThemeToggle />
      </div>

      <div className="mt-5">
        <StampButton onClick={signOut} className="text-ink-muted">
          <LogOut className="h-4 w-4" /> Sign out
        </StampButton>
      </div>
    </Panel>
  );
}

/** A spring-loaded light/dark switch: the knob slides, sun ⇄ moon. */
function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle light / dark mode"
      onClick={toggle}
      className={cn(
        "inset-well relative flex h-9 w-[4.25rem] items-center rounded-full px-1 transition-colors",
        dark ? "bg-ink/30" : "bg-honey/25",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn(
          "grain flex h-7 w-7 items-center justify-center rounded-full bg-surface shadow-soft",
          dark && "ml-auto",
        )}
      >
        {dark ? <Moon className="h-4 w-4 text-sky" /> : <Sun className="h-4 w-4 text-honey" />}
      </motion.span>
    </button>
  );
}
