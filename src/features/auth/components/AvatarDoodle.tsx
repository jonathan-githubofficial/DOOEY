import { useState } from "react";
import type { RecordModel } from "pocketbase";

import { Pencil } from "@/components/icons/lucide";
import { DoodleSvg } from "@/components/doodle-svg";
import { DoodleEditor } from "@/components/doodle-editor";
import { cn } from "@/lib/cn";
import type { Stroke } from "@/lib/doodle";
import { pressDown, pressUp } from "@/lib/motion/press";
import { pb } from "@/lib/pb";
import { useAuthStore } from "@/stores";

/** The hand-drawn profile picture. Tap it to draw yourself — no photo uploads
 * in DOOEY, you doodle who you are. (Unit 3.3 shipped this render-only; unit 7.3 restores the
 * editor half: the DoodleEditor popover + the users.avatar_doodle write. The old motion.button
 * whileHover wiggle is dropped — no hover on Lynx; the press worklets carry the tap feel.) */
export function AvatarDoodle() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !user) return null;
  const strokes: Stroke[] = (user.avatar_doodle as Stroke[] | null) ?? [];

  return (
    <view className="relative">
      {/* No frame, no fill — the doodle stands on the paper itself. */}
      <view
        bindtap={() => setOpen((o) => !o)}
        user-interaction-enabled={true}
        main-thread:bindtouchstart={pressDown}
        main-thread:bindtouchend={pressUp}
        main-thread:bindtouchcancel={pressUp}
        accessibility-label={strokes.length ? "Edit your doodled avatar" : "Doodle your avatar"}
        accessibility-traits="button"
        data-testid="avatar-doodle"
        className={cn(
          "relative flex h-16 w-16 items-center justify-center",
          !strokes.length && "text-ink-muted/40",
        )}
      >
        {strokes.length ? (
          <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
        ) : (
          <Pencil className="h-5 w-5" />
        )}
      </view>

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
    </view>
  );
}
