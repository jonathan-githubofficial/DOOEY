import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Link2, StickyNote, Trash2, Type } from "lucide-react-native";
import { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { boardPhotoUrl, useBoard, useUpdateBoard } from "@/features/boards/api";
import {
  FOLDER_H,
  FOLDER_W,
  NOTE_COLORS,
  STICKERS,
  widthOf,
  type BoardItem,
  type Moodboard,
} from "@/features/boards/types";
import { fontStyle } from "@/features/style/tokens";
import { strokePath } from "@/lib/doodle";
import { alpha, type Palette } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const SCALE_MIN = 0.35;
const SCALE_MAX = 2.5;

/** One mood board: a pinch-zoomable, pannable canvas. Hold a thing a beat to
 * drag it; tap it to select (edit / open / delete from the bar that appears);
 * drop new notes, text and stickers from the tray. */
export default function BoardPage() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: winW, height: winH } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: board } = useBoard(id);
  const update = useUpdateBoard();

  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [stickerTray, setStickerTray] = useState(false);

  // Canvas transform — pan with one finger, pinch to zoom.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);

  const canvasPan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(SCALE_MAX, Math.max(SCALE_MIN, startScale.value * e.scale));
    });
  const canvasGesture = Gesture.Simultaneous(canvasPan, pinch);

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const items = (board?.items ?? []).filter((i) => !i.parent);
  const selectedItem = items.find((i) => i.id === selected) ?? null;

  const saveItems = (next: BoardItem[]) => {
    if (board) update.mutate({ id: board.id, patch: { items: next } });
  };
  const moveItem = (itemId: string, x: number, y: number) => {
    if (!board) return;
    saveItems(board.items.map((i) => (i.id === itemId ? { ...i, x, y } : i)));
  };
  /** Canvas coords of the current viewport center — where new things land. */
  const dropPoint = () => ({
    x: (winW / 2 - tx.value) / scale.value - 80 + Math.random() * 40,
    y: (winH / 2.6 - ty.value) / scale.value + Math.random() * 40,
  });
  const addItem = (item: BoardItem) => {
    if (!board) return;
    saveItems([...board.items, item]);
    setSelected(item.id);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      <Grain />
      <GestureDetector gesture={canvasGesture}>
        <View style={styles.viewport}>
          <Animated.View style={[styles.canvas, canvasStyle]}>
            {board &&
              items.map((item, z) => (
                <CanvasItem
                  key={item.id}
                  board={board}
                  item={item}
                  z={z}
                  scale={scale}
                  colors={colors}
                  selected={selected === item.id}
                  onSelect={() => setSelected((s) => (s === item.id ? null : item.id))}
                  onMove={moveItem}
                />
              ))}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* Floating header over the canvas. */}
      <View style={[styles.head, { top: insets.top + 8 }]} pointerEvents="box-none">
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back to Boards"
          onPress={() => router.back()}
          style={[styles.headBtn, { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) }]}
        >
          <ChevronLeft size={20} color={colors.inkMuted} />
        </PressableScale>
        <View
          style={[
            styles.titleChip,
            { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <Text numberOfLines={1} style={[styles.title, type.display, { color: colors.ink }]}>
            {board?.title ?? ""}
          </Text>
        </View>
      </View>

      {/* Selection actions. */}
      {selectedItem && (
        <View style={[styles.actions, { top: insets.top + 56 }]} pointerEvents="box-none">
          <View
            style={[
              styles.actionBar,
              { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) },
            ]}
          >
            {(selectedItem.kind === "note" || selectedItem.kind === "text") && (
              <ActionBtn label="Edit" onPress={() => setEditing(selectedItem.id)} colors={colors} />
            )}
            {selectedItem.kind === "link" && (
              <ActionBtn
                label="Open"
                onPress={() => Linking.openURL(selectedItem.url)}
                colors={colors}
              />
            )}
            <Pressable
              accessibilityLabel="Delete item"
              hitSlop={8}
              onPress={() => {
                if (!board) return;
                saveItems(board.items.filter((i) => i.id !== selectedItem.id));
                setSelected(null);
              }}
              style={styles.actionIcon}
            >
              <Trash2 size={15} color={colors.clay} />
            </Pressable>
          </View>
        </View>
      )}

      {/* The tray: drop new things onto the canvas. */}
      <View style={[styles.tray, { bottom: Math.max(16, insets.bottom) + 64 }]} pointerEvents="box-none">
        <View
          style={[
            styles.trayBar,
            { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Add a sticky note"
            onPress={() => {
              const p = dropPoint();
              const item: BoardItem = {
                id: `${Date.now()}`,
                kind: "note",
                x: p.x,
                y: p.y,
                rot: Math.random() * 6 - 3,
                text: "",
                color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
              };
              addItem(item);
              setEditing(item.id);
            }}
            style={styles.trayBtn}
          >
            <StickyNote size={18} color={colors.honey} />
          </PressableScale>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Add text"
            onPress={() => {
              const p = dropPoint();
              const item: BoardItem = {
                id: `${Date.now()}`,
                kind: "text",
                x: p.x,
                y: p.y,
                w: 220,
                text: "",
                size: 20,
                font: "display",
                weight: 700,
              };
              addItem(item);
              setEditing(item.id);
            }}
            style={styles.trayBtn}
          >
            <Type size={18} color={colors.ink} />
          </PressableScale>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Add a sticker"
            onPress={() => setStickerTray(true)}
            style={styles.trayBtn}
          >
            <Text style={styles.trayEmoji}>⭐</Text>
          </PressableScale>
        </View>
      </View>

      {/* Sticker picker. */}
      <Modal visible={stickerTray} transparent animationType="fade" onRequestClose={() => setStickerTray(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setStickerTray(false)}>
          <View
            style={[
              styles.stickerSheet,
              { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
            ]}
          >
            {STICKERS.map((emoji) => (
              <PressableScale
                key={emoji}
                scaleTo={0.8}
                onPress={() => {
                  const p = dropPoint();
                  addItem({
                    id: `${Date.now()}`,
                    kind: "sticker",
                    x: p.x,
                    y: p.y,
                    rot: Math.random() * 20 - 10,
                    emoji,
                  });
                  setStickerTray(false);
                }}
                style={styles.stickerBtn}
              >
                <Text style={styles.stickerEmoji}>{emoji}</Text>
              </PressableScale>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Note / text editor. */}
      {editing && board && (
        <ItemEditor
          board={board}
          itemId={editing}
          onSave={saveItems}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

function ActionBtn({ label, onPress, colors }: { label: string; onPress: () => void; colors: Palette }) {
  const type = useType();
  return (
    <Pressable onPress={onPress} style={styles.actionIcon} hitSlop={4}>
      <Text style={[styles.actionLabel, type.sansMedium, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** One thing on the canvas: hold to drag, tap to select. */
function CanvasItem({
  board,
  item,
  z,
  scale,
  colors,
  selected,
  onSelect,
  onMove,
}: {
  board: Moodboard;
  item: BoardItem;
  z: number;
  scale: SharedValue<number>;
  colors: Palette;
  selected: boolean;
  onSelect: () => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart(() => {
      lifted.value = true;
    })
    .onUpdate((e) => {
      dx.value = e.translationX / scale.value;
      dy.value = e.translationY / scale.value;
    })
    .onEnd(() => {
      runOnJS(onMove)(item.id, item.x + dx.value, item.y + dy.value);
    })
    .onFinalize(() => {
      lifted.value = false;
      dx.value = 0;
      dy.value = 0;
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: dx.value },
      { translateY: dy.value },
      { rotate: `${item.rot ?? 0}deg` },
      { scale: withSpring(lifted.value ? 1.05 : 1, { stiffness: 420, damping: 26 }) },
    ],
    zIndex: lifted.value ? 999 : item.kind === "section" ? 0 : z + 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.item, { left: item.x, top: item.y }, style]}>
        <Pressable onPress={onSelect}>
          <View style={selected ? [styles.selectedRing, { borderColor: colors.zest }] : null}>
            <ItemBody board={board} item={item} colors={colors} />
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

function ItemBody({ board, item, colors }: { board: Moodboard; item: BoardItem; colors: Palette }) {
  const w = widthOf(item);
  switch (item.kind) {
    case "note":
      return (
        <View
          style={[
            styles.note,
            { width: w, backgroundColor: alpha(colors[item.color], 0.3) },
          ]}
        >
          <Text style={[styles.noteText, fontStyle("outfit", "400"), { color: colors.ink }]}>
            {item.text || " "}
          </Text>
        </View>
      );
    case "text": {
      const fk = item.font === "mono" ? "mono" : item.font === "body" ? "outfit" : "fraunces";
      const weight = (item.weight ?? 600) >= 800 ? "900" : (item.weight ?? 600) >= 600 ? "700" : "400";
      return (
        <Text
          style={[
            { width: w, fontSize: item.size ?? 18, color: colors.ink },
            fontStyle(fk, weight),
          ]}
        >
          {item.text || " "}
        </Text>
      );
    }
    case "link":
      return (
        <View
          style={[
            styles.link,
            { width: w, backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <Link2 size={13} color={colors.sky} />
          <Text numberOfLines={1} style={[styles.linkText, fontStyle("outfit", "500"), { color: colors.ink }]}>
            {item.label || item.url}
          </Text>
        </View>
      );
    case "sticker":
      return <Text style={{ fontSize: w * 0.72, lineHeight: w * 0.85 }}>{item.emoji}</Text>;
    case "photo": {
      const h = w / item.aspect;
      return (
        <View
          style={
            item.frame === "polaroid"
              ? [styles.polaroid, { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.6) }]
              : item.frame === "stamp"
                ? [styles.stampFrame, { borderColor: alpha(colors.inkMuted, 0.5) }]
                : null
          }
        >
          <Image
            source={{ uri: boardPhotoUrl(board.id, item.file) }}
            style={{ width: w, height: h, borderRadius: item.frame === "plain" ? 8 : 2 }}
          />
        </View>
      );
    }
    case "doodle": {
      const h = item.w / item.aspect;
      return (
        <Svg width={item.w} height={h} viewBox={`0 0 100 ${100 / item.aspect}`}>
          {item.strokes.map((s, i) => (
            <Path
              key={i}
              d={strokePath(s.points)}
              fill="none"
              stroke={colors[s.color as keyof Palette] ?? colors.ink}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
          ))}
        </Svg>
      );
    }
    case "group":
      return (
        <View style={{ width: FOLDER_W }}>
          <View
            style={[
              styles.folderTab,
              { backgroundColor: alpha(colors[item.color], 0.35), borderColor: alpha(colors[item.color], 0.5) },
            ]}
          />
          <View
            style={[
              styles.folderBody,
              {
                height: FOLDER_H - 14,
                backgroundColor: alpha(colors[item.color], 0.18),
                borderColor: alpha(colors[item.color], 0.4),
              },
            ]}
          >
            <Text numberOfLines={1} style={[styles.folderLabel, fontStyle("outfit", "500"), { color: colors.ink }]}>
              {item.label}
            </Text>
          </View>
        </View>
      );
    case "section":
      return (
        <View
          style={[
            styles.section,
            {
              width: item.w,
              height: item.h,
              borderColor: alpha(colors[item.color], 0.4),
              backgroundColor: alpha(colors[item.color], 0.06),
            },
          ]}
        >
          <Text style={[styles.sectionLabel, fontStyle("outfit", "500"), { color: alpha(colors.ink, 0.7) }]}>
            {item.label}
          </Text>
        </View>
      );
  }
}

/** Edit a note's or text's words in a small centered card. */
function ItemEditor({
  board,
  itemId,
  onSave,
  onClose,
}: {
  board: Moodboard;
  itemId: string;
  onSave: (items: BoardItem[]) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const item = board.items.find((i) => i.id === itemId);
  const [text, setText] = useState(item && (item.kind === "note" || item.kind === "text") ? item.text : "");
  if (!item) return null;

  const save = () => {
    onSave(board.items.map((i) => (i.id === itemId ? { ...i, text } : i)));
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.editorCard,
            { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            multiline
            placeholder={item.kind === "note" ? "Sticky note…" : "Say it big…"}
            placeholderTextColor={alpha(colors.inkMuted, 0.5)}
            style={[styles.editorInput, type.sans, { color: colors.ink }]}
          />
          <View style={styles.editorFooter}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[styles.editorCancel, type.sansMedium, { color: colors.inkMuted }]}>
                Cancel
              </Text>
            </Pressable>
            <PressableScale
              scaleTo={0.94}
              onPress={save}
              style={[styles.editorSave, { backgroundColor: colors.zest }]}
            >
              <Text style={[styles.editorSaveText, type.sansSemiBold, { color: colors.paper }]}>
                Save
              </Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  viewport: { flex: 1, overflow: "hidden" },
  canvas: { position: "absolute", left: 0, top: 0, width: 3000, height: 3000 },
  item: { position: "absolute" },
  selectedRing: {
    borderWidth: 2,
    borderRadius: 10,
    margin: -4,
    padding: 2,
  },
  head: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headBtn: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  titleChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxWidth: "70%",
  },
  title: { fontSize: 15, letterSpacing: -0.2 },
  actions: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionIcon: { paddingHorizontal: 10, paddingVertical: 6 },
  actionLabel: { fontSize: 12 },
  tray: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  trayBar: {
    flexDirection: "row",
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
  },
  trayBtn: {
    height: 40,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  trayEmoji: { fontSize: 17 },
  note: {
    minHeight: 90,
    borderRadius: 4,
    padding: 12,
  },
  noteText: { fontSize: 13, lineHeight: 18 },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  linkText: { flex: 1, minWidth: 0, fontSize: 12 },
  polaroid: {
    padding: 8,
    paddingBottom: 28,
    borderWidth: 1,
    borderRadius: 3,
  },
  stampFrame: {
    padding: 4,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 4,
  },
  folderTab: {
    marginLeft: 10,
    height: 14,
    width: 56,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  folderBody: {
    borderWidth: 1,
    borderRadius: 10,
    borderTopLeftRadius: 2,
    justifyContent: "flex-end",
    padding: 8,
  },
  folderLabel: { fontSize: 12 },
  section: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 10,
  },
  sectionLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 16, 12, 0.35)",
    padding: 24,
  },
  stickerSheet: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
  },
  stickerBtn: {
    height: 52,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  stickerEmoji: { fontSize: 26 },
  editorCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  editorInput: {
    minHeight: 90,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  editorFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editorCancel: { fontSize: 12, padding: 8 },
  editorSave: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  editorSaveText: { fontSize: 12 },
});
