import { Check, Pencil, Plus, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, type ComposedGesture } from "react-native-gesture-handler";
import { DoodleEditor } from "@/components/DoodleEditor";
import { PressableScale } from "@/components/pressable-scale";
import type { Stroke } from "@/lib/doodle";
import { alpha, type Palette } from "@/lib/theme";
import { openPrompt } from "@/stores/sheet";
import { useType } from "@/stores/theme";
import { DoodleArt } from "./ItemBody";
import {
  normalizeDoodle,
  useCreatePack,
  useDeletePack,
  useDoodlePacks,
  useUpdatePack,
} from "../packs";
import type { PackDoodle } from "../types";

const CELL = 52;

/** Your saved doodles, by pack. Tap one to stamp it into the middle of the
 * view, or carry it out onto the board with a finger. Packs live on the
 * account, so a drawing made on one board is available on every board.
 *
 * Drawing a new one is the one place here that earns a surface of its own: it
 * is a drawing pad, not a form asking what you meant. */
export function DoodleTray({
  colors,
  onDoodleGesture,
  onPlaceDoodle,
}: {
  colors: Palette;
  onDoodleGesture: (
    d: Pick<PackDoodle, "strokes" | "aspect">,
    preview: React.ReactNode,
  ) => ComposedGesture;
  onPlaceDoodle: (d: Pick<PackDoodle, "strokes" | "aspect">) => void;
}) {
  const type = useType();
  const { data: packs } = useDoodlePacks();
  const createPack = useCreatePack();
  const updatePack = useUpdatePack();
  const deletePack = useDeletePack();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const active = packs?.find((p) => p.id === activeId) ?? packs?.[0];

  const newPack = () =>
    openPrompt({
      title: "New pack",
      placeholder: "Pack name",
      confirmLabel: "Create",
      onSubmit: (title) =>
        createPack.mutate(title.trim() || "My doodles", {
          onSuccess: (r) => setActiveId(r.id),
        }),
    });

  /** Save a fresh drawing into the open pack (making one if this is the first)
   * and put it on the board in the same move. */
  const saveDrawing = (strokes: Stroke[]) => {
    if (strokes.length === 0) return;
    const norm = normalizeDoodle(strokes);
    const doodle: PackDoodle = {
      id: `${Date.now()}`,
      name: "",
      strokes: norm.strokes,
      aspect: norm.aspect,
    };
    if (active) {
      updatePack.mutate({ id: active.id, doodles: [...active.doodles, doodle] });
    } else {
      createPack.mutate("My doodles", {
        onSuccess: (r) => {
          setActiveId(r.id);
          updatePack.mutate({ id: r.id, doodles: [doodle] });
        },
      });
    }
    onPlaceDoodle(doodle);
    setDrawing(false);
  };

  return (
    <View>
      <View style={styles.tabs}>
        {packs?.map((p) => (
          <View key={p.id} style={styles.tabRow}>
            <Pressable
              accessibilityLabel={`Pack ${p.title}`}
              onPress={() => setActiveId(p.id)}
              style={[
                styles.tab,
                active?.id === p.id
                  ? { backgroundColor: colors.ink }
                  : { borderWidth: 1, borderColor: alpha(colors.rule, 0.8) },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  type.sansMedium,
                  { color: active?.id === p.id ? colors.paper : colors.inkMuted },
                ]}
              >
                {p.title}
              </Text>
            </Pressable>
            {managing && (
              <Pressable
                accessibilityLabel={`Delete pack ${p.title}`}
                hitSlop={8}
                onPress={() => deletePack.mutate(p.id)}
                style={styles.tabKill}
              >
                <Trash2 size={12} color={colors.clay} />
              </Pressable>
            )}
          </View>
        ))}
        <Pressable
          accessibilityLabel="New pack"
          onPress={newPack}
          style={[styles.tab, styles.tabGhost, { borderColor: alpha(colors.rule, 0.9) }]}
        >
          <Plus size={12} color={colors.inkMuted} />
          <Text style={[styles.tabText, type.sansMedium, { color: colors.inkMuted }]}>pack</Text>
        </Pressable>
        {!!packs?.length && (
          <Pressable
            accessibilityLabel={managing ? "Done" : "Manage packs"}
            hitSlop={8}
            onPress={() => setManaging((m) => !m)}
            style={styles.manage}
          >
            {managing ? (
              <Check size={13} color={colors.zest} />
            ) : (
              <Pencil size={13} color={colors.inkMuted} />
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        <PressableScale
          scaleTo={0.92}
          accessibilityLabel="Draw a new doodle"
          onPress={() => setDrawing(true)}
          style={[styles.new, { borderColor: alpha(colors.rule, 0.9) }]}
        >
          <Pencil size={15} color={colors.inkMuted} />
          <Text style={[styles.newText, type.sansMedium, { color: colors.inkMuted }]}>new</Text>
        </PressableScale>

        {active?.doodles.map((d) => {
          const w = d.aspect < 1 ? CELL * 0.7 * d.aspect : CELL * 0.7;
          return (
            <View key={d.id}>
              <GestureDetector
                gesture={onDoodleGesture(
                  d,
                  <DoodleArt strokes={d.strokes} aspect={d.aspect} width={72} strokeWidth={3} />,
                )}
              >
                <View style={[styles.cell, { backgroundColor: alpha(colors.ink, 0.04) }]}>
                  <DoodleArt strokes={d.strokes} aspect={d.aspect} width={w} strokeWidth={3.5} />
                </View>
              </GestureDetector>
              {managing && active && (
                <Pressable
                  accessibilityLabel="Delete doodle"
                  hitSlop={8}
                  onPress={() =>
                    updatePack.mutate({
                      id: active.id,
                      doodles: active.doodles.filter((x) => x.id !== d.id),
                    })
                  }
                  style={[
                    styles.cellKill,
                    { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.9) },
                  ]}
                >
                  <X size={10} color={colors.clay} />
                </Pressable>
              )}
            </View>
          );
        })}

        {active && active.doodles.length === 0 && (
          <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
            Nothing here yet — draw one.
          </Text>
        )}
        {!packs?.length && (
          <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
            Draw a doodle to start your first pack.
          </Text>
        )}
      </View>

      <Modal visible={drawing} transparent animationType="fade" onRequestClose={() => setDrawing(false)}>
        <View style={[styles.studio, { backgroundColor: alpha(colors.ink, 0.35) }]}>
          <DoodleEditor
            heading="new doodle"
            initial={[]}
            onSave={saveDrawing}
            onClose={() => setDrawing(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  tabRow: { flexDirection: "row", alignItems: "center" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tabGhost: { borderWidth: 1, borderStyle: "dashed" },
  tabText: { fontSize: 11 },
  tabKill: { paddingHorizontal: 4 },
  manage: { marginLeft: "auto", padding: 4 },
  grid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  new: {
    height: CELL,
    width: CELL,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  newText: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  cell: {
    height: CELL,
    width: CELL,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  cellKill: {
    position: "absolute",
    right: -4,
    top: -4,
    height: 18,
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  empty: { flex: 1, alignSelf: "center", fontSize: 12 },
  studio: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
});
