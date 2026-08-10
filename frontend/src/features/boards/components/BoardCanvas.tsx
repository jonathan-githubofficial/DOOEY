import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, Frame, Pencil, Redo2, Trash2, Undo2 } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  runOnJS,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { confirmDestructive } from "@/lib/confirm";
import { eraseNear, type InkColor, type Stroke } from "@/lib/doodle";
import { dur, ease, timing } from "@/lib/motion";
import { goBack } from "@/lib/nav";
import { alpha } from "@/lib/theme";
import { openPrompt, openSheet } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { uploadBoardPhoto, useBoardAutosave, useDeleteBoard, useRenameBoard } from "../api";
import {
  addItem,
  beginGesture,
  closeBoard,
  commit,
  commitItems,
  endGesture,
  liveDoodle,
  openBoard,
  patchItem,
  redo,
  removeItem,
  setPhotoDraft,
  undo,
  useCanvasStore,
} from "../store";
import {
  DEFAULT_W,
  NOTE_COLORS,
  SCALE_MAX,
  SCALE_MIN,
  TEXT_DEFAULTS,
  anchorIn,
  contentBounds,
  heightOf,
  type BoardItem,
  type Moodboard,
  type SectionItem,
} from "../types";
import { CanvasItem } from "./CanvasItem";
import { InkCanvas } from "./InkCanvas";
import { Inspector } from "./Inspector";
import { ToolShelf, type PlaceSpec } from "./ToolShelf";

/** How far the eraser reaches, in canvas px. Not the same quantity as the
 * doodle pad's percentage reach, which is why it is not the same name. */
const ERASE_PX = 14;
/** Canvas px between recorded points while drawing. Below this a stroke gains
 * weight and no detail. */
const INK_STEP = 2;

const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Everything resting inside a section right now, by position alone. */
function membersOf(section: SectionItem): string[] {
  const box = { x: section.x, y: section.y, w: section.w, h: section.h };
  return useCanvasStore
    .getState()
    .items.filter((i) => i.id !== section.id && i.kind !== "section" && anchorIn(i, i.x, i.y, box))
    .map((i) => i.id);
}

/** One mood board.
 *
 * The layers, bottom to top: paper, the GPU ink layer, the pieces, a capture
 * sheet that exists only while you are drawing, and the chrome. The viewport
 * is a single transform driven by shared values, so panning and zooming move
 * one view and re-render nothing.
 *
 * The interaction model is the one a hand expects on glass, and every gesture
 * here follows from it: **one finger on a piece moves that piece, one finger
 * on the paper moves the paper, two fingers always move and scale the paper.**
 * There is no press-and-wait before a drag, because the waiting is the
 * friction. A second finger arriving mid-drag hands the gesture over cleanly
 * instead of fighting it. */
export function BoardCanvas({ board }: { board: Moodboard }) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const rename = useRenameBoard();
  const del = useDeleteBoard();

  // The document is hydrated in an effect, so the first paint still comes from
  // the query's copy.
  const items = useCanvasStore((s) => (s.boardId === board.id ? s.items : board.items));
  const doodle = useCanvasStore((s) => (s.boardId === board.id ? s.doodle : board.doodle));
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);

  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [ink, setInk] = useState<InkColor>("zest");
  const [carried, setCarried] = useState<string[]>([]);
  const [hotSection, setHotSection] = useState<string | null>(null);
  const titleRef = useRef<View>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const startScale = useSharedValue(1);
  const carryX = useSharedValue(0);
  const carryY = useSharedValue(0);
  const livePts = useSharedValue<[number, number][]>([]);
  const rubbedX = useSharedValue(0);
  const rubbedY = useSharedValue(0);

  const selectedItem = items.find((i) => i.id === selected) ?? null;

  /* ------------------------------------------------------------ viewport */

  const panPaper = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    });

  const tapPaper = Gesture.Tap().onEnd(() => {
    runOnJS(setSelected)(null);
    runOnJS(setEditing)(null);
  });

  // Two fingers drive the paper wherever they land, including on top of a
  // piece — which is why a piece's own drag gives up at two pointers.
  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, startScale.value * e.scale));
      const k = next / startScale.value;
      // Hold the point between the fingers still while the paper grows under it.
      tx.value = e.focalX - (e.focalX - startTx.value) * k;
      ty.value = e.focalY - (e.focalY - startTy.value) * k;
      scale.value = next;
    });
  const twoFingerPan = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      startTx.value = tx.value;
      startTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX;
      ty.value = startTy.value + e.translationY;
    });
  const viewport = Gesture.Simultaneous(pinch, twoFingerPan);

  /** Pull back until the whole board is on screen.
   *
   * On an endless canvas this is not a convenience, it is the way back. There
   * are no edges to bump into and no minimap, so without it a board you have
   * panned away from is genuinely lost. On an empty board it returns you to
   * the origin, which is where the first piece will land. */
  // Not a useCallback: its identity is never a dependency of anything, and the
  // React Compiler reports that hand-rolled memoization here is what stops it
  // from doing the job itself.
  const frameContent = (animate = true) => {
    const glide = timing(dur.moved, ease.inOut);
    const settle = (v: SharedValue<number>, to: number) => {
      v.value = animate ? withTiming(to, glide) : to;
    };
    const box = contentBounds(useCanvasStore.getState().items);
    if (!box) {
      settle(tx, 0);
      settle(ty, 0);
      settle(scale, 1);
      return;
    }
    const margin = 48;
    // Never magnifies: framing a board with one small note on it should show
    // you the note, not fill the screen with it.
    const next = Math.max(
      SCALE_MIN,
      Math.min(1, winW / (box.w + margin * 2), winH / (box.h + margin * 2)),
    );
    settle(tx, winW / 2 - next * (box.x + box.w / 2));
    settle(ty, winH / 2 - next * (box.y + box.h / 2));
    settle(scale, next);
  };

  // Hydrating the document and framing what is in it are one action, and both
  // need the viewport values above, so the board opens here rather than at the
  // top of the component.
  useBoardAutosave(board.id);
  useEffect(() => {
    openBoard(board);
    // Endless canvas, so there is no "top of the page" to open at: start on
    // whatever is actually on the board.
    frameContent(false);
    return closeBoard;
    // Re-opening the same board is a no-op, so a refetch landing mid-session
    // cannot clobber an edit in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);

  /* --------------------------------------------------------------- edits */

  // Stable identities on purpose: every one of these is a prop on a memoised
  // item, and an arrow rebuilt in the render would re-render the whole board
  // each time the selection moved.
  const select = useCallback((id: string) => {
    setSelected(id);
    setEditing(null);
  }, []);
  const edit = useCallback((id: string) => setEditing(id), []);
  const stopEditing = useCallback(() => setEditing(null), []);
  const move = useCallback((id: string, x: number, y: number) => patchItem(id, { x, y }), []);
  const rotateTo = useCallback((id: string, rot: number) => patchItem(id, { rot }), []);
  const resizeTo = useCallback((id: string, w: number, h: number) => {
    const item = useCanvasStore.getState().items.find((i) => i.id === id);
    if (!item) return;
    if (item.kind === "section") patchItem(id, { w, h });
    else if (item.kind === "text") {
      // Text scales its type with its box: dragging it bigger is how a
      // headline gets made.
      const grew = w / item.w;
      patchItem(id, { w, size: Math.round((item.size ?? TEXT_DEFAULTS.size) * grew * 10) / 10 });
    } else patchItem(id, { w });
  }, []);
  const setText = useCallback((id: string, text: string) => {
    const item = useCanvasStore.getState().items.find((i) => i.id === id);
    patchItem(id, item?.kind === "section" ? { label: text } : { text });
  }, []);
  const setLink = useCallback(
    (id: string, patch: { url?: string; label?: string }) => patchItem(id, patch),
    [],
  );

  /** Where a new piece lands: under the finger that carried it out, or in the
   * middle of what you are looking at if the tool was tapped. */
  const dropAt = (at: { x: number; y: number } | undefined, w: number, h: number) => {
    const sx = at?.x ?? winW / 2;
    const sy = at?.y ?? winH / 2 - 60;
    return {
      x: Math.round((sx - tx.value) / scale.value - w / 2),
      y: Math.round((sy - ty.value) / scale.value - h / 2),
    };
  };

  const place = async (spec: PlaceSpec, at?: { x: number; y: number }) => {
    const id = uid();

    if (spec.kind === "photo") {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
      });
      const asset = res.canceled ? null : res.assets[0];
      if (!asset) return;
      const aspect = asset.width && asset.height ? asset.width / asset.height : 1;
      const w = DEFAULT_W.photo;
      // On the paper before the upload even starts. The frame and the crop are
      // chosen afterwards, on the canvas, next to the picture — a better place
      // to decide than a dialog that appears before you can see it.
      setPhotoDraft(id, asset.uri);
      addItem({
        id,
        kind: "photo",
        ...dropAt(at, w, w / aspect),
        w,
        file: "",
        rot: rand(-5, 5),
        frame: "plain",
        aspect,
      });
      setSelected(id);
      try {
        await uploadBoardPhoto(board.id, id, asset.uri, asset.mimeType);
      } catch {
        // The upload is the only thing that makes a photo real. If it did not
        // land, the piece never arrived either: leaving it would pin an empty
        // grey box to the board with no way to fill it.
        removeItem(id);
      }
      return;
    }

    let item: BoardItem;
    switch (spec.kind) {
      case "note":
        item = {
          id,
          kind: "note",
          ...dropAt(at, DEFAULT_W.note, 96),
          w: DEFAULT_W.note,
          rot: rand(-3, 3),
          text: "",
          color: NOTE_COLORS[Math.floor(rand(0, NOTE_COLORS.length))],
        };
        break;
      case "text":
        item = {
          id,
          kind: "text",
          ...dropAt(at, DEFAULT_W.text, 28),
          w: DEFAULT_W.text,
          text: "",
          size: 22,
          font: TEXT_DEFAULTS.font,
          weight: 700,
        };
        break;
      case "link":
        item = { id, kind: "link", ...dropAt(at, DEFAULT_W.link, 48), url: "", label: "" };
        break;
      case "section":
        item = {
          id,
          kind: "section",
          ...dropAt(at, DEFAULT_W.section, 300),
          w: DEFAULT_W.section,
          h: 300,
          label: "Section",
          color: "sky",
        };
        break;
      case "sticker":
        item = {
          id,
          kind: "sticker",
          ...dropAt(at, DEFAULT_W.sticker, DEFAULT_W.sticker),
          w: DEFAULT_W.sticker,
          rot: rand(-12, 12),
          emoji: spec.emoji,
        };
        break;
      case "doodle":
        item = {
          id,
          kind: "doodle",
          ...dropAt(at, DEFAULT_W.doodle, DEFAULT_W.doodle / spec.aspect),
          w: DEFAULT_W.doodle,
          rot: rand(-4, 4),
          aspect: spec.aspect,
          strokes: spec.strokes,
        };
        break;
    }
    addItem(item);
    setSelected(id);
    // Anything made of words opens asking for them: placing a note and writing
    // in it is one motion, not two.
    if (item.kind === "note" || item.kind === "text" || item.kind === "link") setEditing(id);
  };

  // A removed photo keeps its uploaded file. Deleting it here would make undo
  // a liar: the item would come back pointing at nothing. The file goes when
  // the board does.
  const destroy = (item: BoardItem) => {
    removeItem(item.id);
    setSelected(null);
    setEditing(null);
  };

  /* -------------------------------------------------------------- sections */

  const onCarryStart = useCallback((id: string) => {
    const section = useCanvasStore.getState().items.find((i) => i.id === id);
    if (section?.kind === "section") setCarried(membersOf(section));
  }, []);

  const onCarryEnd = useCallback(
    (id: string, dx: number, dy: number) => {
      const riders = new Set(carried);
      commitItems((list) =>
        list.map((i) =>
          i.id === id || riders.has(i.id)
            ? { ...i, x: Math.round(i.x + dx), y: Math.round(i.y + dy) }
            : i,
        ),
      );
      setCarried([]);
      carryX.value = 0;
      carryY.value = 0;
    },
    [carried, carryX, carryY],
  );

  /** Which section a dragged piece is resting on. Only the highlight depends
   * on this: sections group by position, so nothing is filed anywhere and
   * there is nothing to undo if you change your mind. */
  const onHover = useCallback((id: string, x: number, y: number) => {
    const list = useCanvasStore.getState().items;
    const dragged = list.find((i) => i.id === id);
    if (!dragged) return;
    const over = list.find(
      (s): s is SectionItem =>
        s.kind === "section" && anchorIn(dragged, x, y, { x: s.x, y: s.y, w: s.w, h: s.h }),
    );
    setHotSection(over?.id ?? null);
  }, []);
  const onHoverEnd = useCallback(() => setHotSection(null), []);

  /* --------------------------------------------------------------- drawing */

  const commitStroke = useCallback(
    (points: [number, number][]) => {
      if (points.length < 2) return;
      const stroke: Stroke = { color: ink, points };
      commit({ doodle: [...useCanvasStore.getState().doodle, stroke] });
    },
    [ink],
  );

  const rub = useCallback((x: number, y: number) => {
    liveDoodle(eraseNear(useCanvasStore.getState().doodle, x, y, ERASE_PX));
  }, []);

  const drawGesture = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      const px = (e.x - tx.value) / scale.value;
      const py = (e.y - ty.value) / scale.value;
      if (erasing) {
        rubbedX.value = px;
        rubbedY.value = py;
        runOnJS(beginGesture)();
        runOnJS(rub)(px, py);
      } else {
        livePts.value = [[px, py]];
      }
    })
    .onUpdate((e) => {
      const px = (e.x - tx.value) / scale.value;
      const py = (e.y - ty.value) / scale.value;
      if (erasing) {
        // Rubbing out rebuilds the stroke list, which is real work: only ask
        // for it once the eraser has actually moved somewhere new.
        if (Math.abs(px - rubbedX.value) + Math.abs(py - rubbedY.value) > ERASE_PX / 3) {
          rubbedX.value = px;
          rubbedY.value = py;
          runOnJS(rub)(px, py);
        }
        return;
      }
      const pts = livePts.value;
      const last = pts[pts.length - 1];
      if (!last || Math.abs(px - last[0]) + Math.abs(py - last[1]) > INK_STEP) {
        livePts.value = [...pts, [px, py]];
      }
    })
    .onFinalize(() => {
      if (erasing) {
        runOnJS(endGesture)();
        return;
      }
      runOnJS(commitStroke)(livePts.value);
      livePts.value = [];
    });

  /* --------------------------------------------------- keyboard clearance */

  // A note near the bottom of the screen would sit under the keyboard the
  // moment you tapped into it, so the paper slides up to meet you and slides
  // back when the keyboard goes. Nothing else moves.
  const shifted = useRef(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      const item = useCanvasStore.getState().items.find((i) => i.id === editing);
      if (!item) return;
      const bottom = (item.y + heightOf(item)) * scale.value + ty.value;
      const lift = bottom - (winH - e.endCoordinates.height - 24);
      if (lift <= 0) return;
      shifted.current = lift;
      ty.value = withTiming(ty.value - lift, timing(dur.moved, ease.inOut));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      if (shifted.current === 0) return;
      ty.value = withTiming(ty.value + shifted.current, timing(dur.moved, ease.inOut));
      shifted.current = 0;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [editing, scale, ty, winH]);

  /* -------------------------------------------------------------------- ui */

  const shelfBottom = Math.max(insets.bottom, 12) + 8;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper }]}>
      <Grain />

      <GestureDetector gesture={viewport}>
        <View style={styles.viewport}>
          <InkCanvas
            tx={tx}
            ty={ty}
            scale={scale}
            strokes={doodle}
            live={livePts}
            liveInk={ink}
            colors={colors}
          />

          {/* The paper reaches past its own edges: pulled far enough back the
              board no longer fills the screen, and a finger on the margin
              still has to move the board rather than land on nothing. */}
          <GestureDetector gesture={Gesture.Exclusive(panPaper, tapPaper)}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>

          {/* Not a sheet of paper with a transform on it: there is no sheet.
              Each piece carries the viewport's shared values and places itself,
              which is what lets the board go on forever. */}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {items.map((item, z) => (
                <CanvasItem
                  key={item.id}
                  boardId={board.id}
                  item={item}
                  z={z}
                  scale={scale}
                  tx={tx}
                  ty={ty}
                  colors={colors}
                  selected={selected === item.id}
                  editing={editing === item.id}
                  carried={carried.includes(item.id)}
                  carryX={carryX}
                  carryY={carryY}
                  hot={hotSection === item.id}
                  onSelect={select}
                  onEdit={edit}
                  onEditEnd={stopEditing}
                  onMoved={move}
                  onSized={resizeTo}
                  onRotated={rotateTo}
                  onText={setText}
                  onLink={setLink}
                  onCarryStart={onCarryStart}
                  onCarryEnd={onCarryEnd}
                  onHover={onHover}
                  onHoverEnd={onHoverEnd}
                />
              ))}
          </View>

          {/* Draw mode lays a sheet over the pieces, so while the pen is up
              nothing on the board can be picked up by accident. */}
          {drawing && (
            <GestureDetector gesture={drawGesture}>
              <View style={StyleSheet.absoluteFill} />
            </GestureDetector>
          )}
        </View>
      </GestureDetector>

      <View style={[styles.head, { top: insets.top + 8 }]} pointerEvents="box-none">
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back to Boards"
          onPress={() => goBack("/boards")}
          style={[
            styles.headBtn,
            { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <ChevronLeft size={20} color={colors.inkMuted} />
        </PressableScale>

        {/* The title is the board's own menu: renaming and deleting are the
            only two things you can do to a board as a whole, and they belong
            on the thing they act on rather than in a corner.
            It measures itself first so the menu unfolds out of the title, the
            way every other menu in the app unfolds out of its own button. An
            unanchored menu falls back to the bottom drawer, which is for
            questions the app asks, not for a menu you opened. */}
        <Pressable
          ref={titleRef}
          accessibilityLabel={`${board.title} options`}
          onPress={() =>
            titleRef.current?.measureInWindow((x, y, width, height) =>
            openSheet({
              anchor: { x, y, width, height },
              title: board.title,
              actions: [
                {
                  label: "Rename",
                  symbol: "pencil",
                  icon: <Pencil size={17} color={colors.ink} />,
                  onPress: () =>
                    openPrompt({
                      title: "Rename board",
                      initial: board.title,
                      placeholder: "Board name",
                      confirmLabel: "Save",
                      onSubmit: (title) => rename.mutate({ id: board.id, title }),
                    }),
                },
                {
                  label: "Delete board",
                  symbol: "trash",
                  destructive: true,
                  icon: <Trash2 size={17} color={colors.clay} />,
                  onPress: () =>
                    confirmDestructive(
                      `Delete “${board.title}”?`,
                      "The board and every piece pinned to it go for good.",
                      "Delete board",
                      () => {
                        del.mutate(board.id);
                        goBack("/boards");
                      },
                    ),
                },
              ],
            }),
            )
          }
          style={[
            styles.titleChip,
            { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <Text numberOfLines={1} style={[styles.title, type.display, { color: colors.ink }]}>
            {board.title}
          </Text>
        </Pressable>

        <View
          style={[
            styles.history,
            { backgroundColor: alpha(colors.surface, 0.95), borderColor: alpha(colors.rule, 0.7) },
          ]}
        >
          <HistoryBtn label="Frame the whole board" on onPress={frameContent}>
            <Frame size={15} color={colors.ink} />
          </HistoryBtn>
          <View style={[styles.headRule, { backgroundColor: alpha(colors.rule, 0.9) }]} />
          <HistoryBtn label="Undo" on={canUndo} onPress={undo}>
            <Undo2 size={16} color={canUndo ? colors.ink : alpha(colors.inkMuted, 0.4)} />
          </HistoryBtn>
          <HistoryBtn label="Redo" on={canRedo} onPress={redo}>
            <Redo2 size={16} color={canRedo ? colors.ink : alpha(colors.inkMuted, 0.4)} />
          </HistoryBtn>
        </View>
      </View>

      {selectedItem && !drawing && (
        <Inspector
          item={selectedItem}
          colors={colors}
          bottom={shelfBottom + 62}
          onPatch={(patch) => patchItem(selectedItem.id, patch)}
          onEdit={() => setEditing(selectedItem.id)}
          // No confirmation: undo sits in the header, and asking twice about
          // something that cheap is the friction, not the safety.
          onDelete={() => destroy(selectedItem)}
        />
      )}

      <ToolShelf
        colors={colors}
        bottom={shelfBottom}
        drawing={drawing}
        ink={ink}
        erasing={erasing}
        onInk={(c) => {
          setInk(c);
          setErasing(false);
        }}
        onDraw={(on) => {
          setDrawing(on);
          setErasing(false);
          if (on) {
            setSelected(null);
            setEditing(null);
          }
        }}
        onToggleErase={() => setErasing((e) => !e)}
        onPlace={(spec, at) => void place(spec, at)}
      />
    </View>
  );
}

function HistoryBtn({
  label,
  on,
  onPress,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      scaleTo={0.85}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !on }}
      disabled={!on}
      onPress={onPress}
      style={styles.historyBtn}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  viewport: { flex: 1, overflow: "hidden" },
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
    flexShrink: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  title: { fontSize: 15, letterSpacing: -0.2 },
  history: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 2,
  },
  headRule: { height: 16, width: 1 },
  historyBtn: {
    height: 36,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
});
