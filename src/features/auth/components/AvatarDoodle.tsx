import { Pencil } from "@/components/icons/lucide";
import { DoodleSvg } from "@/components/doodle-svg";
import type { Stroke } from "@/lib/doodle";
import { useAuthStore } from "@/stores";

/** The hand-drawn profile picture (unit 3.3, ported RENDER-ONLY from
 * src-legacy/features/auth/components/AvatarDoodle.tsx). It DISPLAYS the saved avatar doodle;
 * it is not a control here.
 *
 * DROPPED / DEFERRED to unit 7.3 (doodles) - recorded per PLAN 5.5 (doodle canvas = highest
 * risk, Phase 7) and the story BROOM: the `open` state, the motion.button whileHover/whileTap,
 * the DoodleEditor popover, and the onSave -> pb.collection("users").update(..., { avatar_doodle })
 * write. src-legacy/.../AvatarDoodle.tsx is intentionally NOT broomed - unit 7.3 consumes its
 * editor half. */
export function AvatarDoodle() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated || !user) return null;
  const strokes: Stroke[] = (user.avatar_doodle as Stroke[] | null) ?? [];

  return (
    <view className="relative flex h-16 w-16 items-center justify-center">
      {strokes.length ? (
        <DoodleSvg strokes={strokes} strokeWidth={1.8} relative />
      ) : (
        <view className="text-ink-muted">
          <Pencil className="h-5 w-5" />
        </view>
      )}
    </view>
  );
}
