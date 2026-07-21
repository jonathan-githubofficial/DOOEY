import { Pencil } from "lucide-react-native";
import type { RecordModel } from "pocketbase";
import { useState } from "react";
import { Modal, Pressable, StyleSheet } from "react-native";
import { DoodleEditor } from "@/components/DoodleEditor";
import { PressableScale } from "@/components/pressable-scale";
import { DoodleSvg } from "@/components/DoodleSvg";
import type { Stroke } from "@/lib/doodle";
import { pb } from "@/lib/pb";
import { alpha } from "@/lib/theme";
import { useAuthStore } from "@/stores/auth";
import { usePalette } from "@/stores/theme";

/** The hand-drawn profile picture. Tap it to draw yourself — no photo uploads
 * in DOOEY, you doodle who you are. */
export function AvatarDoodle() {
  const colors = usePalette();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !user) return null;
  const strokes: Stroke[] = (user.avatar_doodle as Stroke[] | null) ?? [];

  return (
    <>
      {/* No frame, no fill — the doodle stands on the paper itself. */}
      <PressableScale
        scaleTo={0.9}
        accessibilityLabel={strokes.length ? "Edit your doodled avatar" : "Doodle your avatar"}
        onPress={() => setOpen(true)}
        style={styles.avatar}
      >
        {strokes.length ? (
          <DoodleSvg strokes={strokes} />
        ) : (
          <Pencil size={20} color={alpha(colors.inkMuted, 0.4)} />
        )}
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Swallow taps on the card itself so only the backdrop closes. */}
          <Pressable onPress={() => {}}>
            <DoodleEditor
              heading="doodle yourself"
              initial={strokes}
              onClose={() => setOpen(false)}
              onSave={async (next) => {
                const record = await pb
                  .collection("users")
                  .update(user.id, { avatar_doodle: next }, { requestKey: null });
                useAuthStore.getState().setUser(record as RecordModel, pb.authStore.token);
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    height: 64,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 16, 12, 0.35)",
  },
});
