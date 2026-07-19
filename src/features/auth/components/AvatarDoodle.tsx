import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { pb } from "@/lib/pb";
import { DoodleSvg } from "@/components/doodle-svg";
import { DoodleEditor } from "@/components/doodle-editor";
import type { Stroke } from "@/lib/doodle";
import { useAuthStore } from "@/stores";
import type { RecordModel } from "pocketbase";

/** The hand-drawn profile picture. Tap it to draw yourself — no photo uploads
 * in DOOEY, you doodle who you are. */
export function AvatarDoodle() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !user) return null;
  const strokes: Stroke[] = (user.avatar_doodle as Stroke[] | null) ?? [];

  return (
    <div className="relative">
      {/* No frame, no fill — the doodle stands on the paper itself. */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.06, rotate: -2 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        aria-label={strokes.length ? "Edit your doodled avatar" : "Doodle your avatar"}
        title="Doodle yourself"
        className={cn(
          "relative flex h-16 w-16 items-center justify-center",
          !strokes.length && "text-ink-muted/40 transition-colors hover:text-ink",
        )}
      >
        {strokes.length ? (
          <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
        ) : (
          <Pencil className="h-5 w-5" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <DoodleEditor
            heading="doodle yourself"
            initial={strokes}
            className="absolute left-0 top-[4.5rem] z-50"
            onClose={() => setOpen(false)}
            onSave={async (next) => {
              const record = await pb
                .collection("users")
                .update(user.id, { avatar_doodle: next }, { requestKey: null });
              useAuthStore.getState().setUser(record as RecordModel, pb.authStore.token);
              setOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
