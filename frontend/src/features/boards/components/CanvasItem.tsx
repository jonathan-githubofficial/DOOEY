import { Maximize2, RotateCw } from "lucide-react-native";
import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { gesture as springs } from "@/lib/motion";
import { alpha, type Palette } from "@/lib/theme";
import { ItemBody } from "./ItemBody";
import {
  SECTION_HEAD_H,
  SECTION_H_LIMITS,
  SECTION_RADIUS,
  SIZE_LIMITS,
  heightOf,
  widthOf,
  type BoardItem,
} from "../types";

/** Handles keep this size on screen at any zoom, so they stay thumb-sized when
 * the board is pulled far back. */
const HANDLE = 30;
/** Canvas px a dragged piece must travel before the canvas is asked again
 * which section it is over. Without it a drag wakes the JS thread sixty times
 * a second to answer the same question. */
const HOVER_STEP = 10;

/** Kinds whose resize is a straight scale of the whole object: the picture,
 * the drawing, the emoji, the headline (whose type grows with its box). Notes
 * and sections instead change their box and let the contents reflow. */
function scalesWhole(kind: BoardItem["kind"]): boolean {
  return kind === "photo" || kind === "doodle" || kind === "sticker" || kind === "text";
}

/** One piece on the board.
 *
 * Every gesture runs on the UI thread and touches React exactly once, on
 * release. A drag is a transform, a rotation is a transform, a resize is
 * either a transform or an animated box. Nothing re-renders while a finger is
 * down, which is the whole reason this reads as an object being moved rather
 * than a view being repositioned by state. */
export const CanvasItem = memo(function CanvasItem({
  boardId,
  item,
  z,
  scale,
  tx,
  ty,
  colors,
  selected,
  editing,
  carried,
  carryX,
  carryY,
  hot,
  onSelect,
  onEdit,
  onEditEnd,
  onMoved,
  onSized,
  onRotated,
  onText,
  onLink,
  onCarryStart,
  onCarryEnd,
  onHover,
  onHoverEnd,
}: {
  boardId: string;
  item: BoardItem;
  z: number;
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  colors: Palette;
  selected: boolean;
  editing: boolean;
  /** This piece is resting on a section that is being dragged right now. */
  carried: boolean;
  carryX: SharedValue<number>;
  carryY: SharedValue<number>;
  /** A loose piece is hovering over this section right now. */
  hot: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onEditEnd: () => void;
  onMoved: (id: string, x: number, y: number) => void;
  onSized: (id: string, w: number, h: number) => void;
  onRotated: (id: string, rot: number) => void;
  onText: (id: string, text: string) => void;
  onLink: (id: string, patch: { url?: string; label?: string }) => void;
  onCarryStart: (id: string) => void;
  onCarryEnd: (id: string, dx: number, dy: number) => void;
  onHover: (id: string, x: number, y: number) => void;
  onHoverEnd: () => void;
}) {
  const isSection = item.kind === "section";
  const whole = scalesWhole(item.kind);
  const baseW = widthOf(item);
  const baseH = heightOf(item);

  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const lifted = useSharedValue(false);
  const spin = useSharedValue(item.rot ?? 0);
  const grow = useSharedValue(1);
  const boxW = useSharedValue(baseW);
  const boxH = useSharedValue(baseH);
  const reportedX = useSharedValue(0);
  const reportedY = useSharedValue(0);

  // The record can change under us: an undo, a section carrying this piece,
  // a colour swap. Re-seat the live values on whatever the document now says.
  useEffect(() => {
    spin.value = item.rot ?? 0;
    boxW.value = baseW;
    boxH.value = baseH;
  }, [item.rot, baseW, baseH, spin, boxW, boxH]);

  const drag = Gesture.Pan()
    .maxPointers(1) // a second finger hands the touch to the canvas pinch
    .enabled(!editing)
    .onStart(() => {
      lifted.value = true;
      reportedX.value = 0;
      reportedY.value = 0;
      if (isSection) runOnJS(onCarryStart)(item.id);
    })
    .onUpdate((e) => {
      dx.value = e.translationX / scale.value;
      dy.value = e.translationY / scale.value;
      if (isSection) {
        carryX.value = dx.value;
        carryY.value = dy.value;
      } else if (
        Math.abs(dx.value - reportedX.value) + Math.abs(dy.value - reportedY.value) >
        HOVER_STEP
      ) {
        reportedX.value = dx.value;
        reportedY.value = dy.value;
        runOnJS(onHover)(item.id, item.x + dx.value, item.y + dy.value);
      }
    })
    .onEnd(() => {
      if (isSection) runOnJS(onCarryEnd)(item.id, dx.value, dy.value);
      else runOnJS(onMoved)(item.id, Math.round(item.x + dx.value), Math.round(item.y + dy.value));
    })
    .onFinalize(() => {
      lifted.value = false;
      dx.value = 0;
      dy.value = 0;
      if (!isSection) runOnJS(onHoverEnd)();
    });

  // Tap selects; tapping what is already selected opens it for typing. Two
  // steps rather than one so a finger landing on a note never eats a drag.
  const tap = Gesture.Tap()
    .maxDuration(260)
    .onEnd(() => runOnJS(selected ? onEdit : onSelect)(item.id));

  const handling = Gesture.Exclusive(drag, tap);

  const rotate = Gesture.Pan()
    .onUpdate((e) => {
      // The finger in canvas coordinates, measured against the piece's centre:
      // the handle points wherever you point it.
      const px = (e.absoluteX - tx.value) / scale.value;
      const py = (e.absoluteY - ty.value) / scale.value;
      const cx = item.x + (whole ? baseW * grow.value : boxW.value) / 2;
      const cy = item.y + (whole ? baseH * grow.value : boxH.value) / 2;
      spin.value = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
    })
    .onEnd(() => runOnJS(onRotated)(item.id, Math.round(spin.value)));

  const limits = SIZE_LIMITS[item.kind];
  const resize = Gesture.Pan()
    .onUpdate((e) => {
      const w = Math.min(limits.max, Math.max(limits.min, baseW + e.translationX / scale.value));
      if (whole) {
        grow.value = w / baseW;
      } else {
        boxW.value = w;
        if (isSection) {
          boxH.value = Math.min(
            SECTION_H_LIMITS.max,
            Math.max(SECTION_H_LIMITS.min, baseH + e.translationY / scale.value),
          );
        }
      }
    })
    .onEnd(() => {
      const w = whole ? Math.round(baseW * grow.value) : Math.round(boxW.value);
      runOnJS(onSized)(item.id, w, Math.round(boxH.value));
      grow.value = 1;
    });

  // The board has no edges and therefore no container: a parent big enough to
  // hold an endless canvas cannot exist, and React Native on Android will not
  // hit-test a child that sits outside its parent's bounds. So each piece
  // places *itself* in screen space, straight from the viewport's shared
  // values. Every piece lays out at the viewport's origin and is carried to
  // where it belongs by a transform, which keeps it inside the parent's box
  // for touch purposes no matter where on the board it lives.
  const placement = useAnimatedStyle(() => {
    const s = scale.value;
    return {
      transform: [
        { translateX: tx.value + s * (item.x + dx.value + (carried ? carryX.value : 0)) },
        { translateY: ty.value + s * (item.y + dy.value + (carried ? carryY.value : 0)) },
        { scale: s },
      ],
    };
  });
  // Rotation and the pickup dip stay on an inner view, where the default
  // centre origin is the one they want.
  const wrapper = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spin.value}deg` },
      { scale: withSpring(lifted.value ? 1.03 : 1, springs.press) },
    ],
  }));
  const sizing = useAnimatedStyle(() =>
    whole
      ? { transform: [{ scale: grow.value }] }
      : isSection
        ? { width: boxW.value, height: boxH.value }
        : { width: boxW.value },
  );
  const grabBar = useAnimatedStyle(() => ({ width: boxW.value }));

  // Selection chrome has to trace the box you can *see*. Boxed kinds animate
  // real width and height, so the ring and the handles follow for free. Kinds
  // that preview a resize as a transform do not change their layout at all, so
  // the chrome would sit at the old corner for the length of the drag: these
  // styles carry the same growth, while the knobs keep cancelling the zoom so
  // they stay thumb-sized.
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: whole ? grow.value : 1 }],
  }));
  const rotateKnob = useAnimatedStyle(() => ({
    transform: [
      { translateY: (-((whole ? grow.value : 1) - 1) * baseH) / 2 },
      { scale: 1 / scale.value },
    ],
  }));
  const resizeKnob = useAnimatedStyle(() => {
    const g = whole ? grow.value : 1;
    return {
      transform: [
        { translateX: ((g - 1) * baseW) / 2 },
        { translateY: ((g - 1) * baseH) / 2 },
        { scale: 1 / scale.value },
      ],
    };
  });

  const body = (
    <ItemBody
      boardId={boardId}
      item={item}
      editing={editing}
      onText={(text) => onText(item.id, text)}
      onLink={(patch) => onLink(item.id, patch)}
      onEditEnd={onEditEnd}
    />
  );

  return (
    <Animated.View
      style={[styles.item, { zIndex: isSection ? 0 : z + 1 }, placement]}
      pointerEvents="box-none"
    >
      <Animated.View style={wrapper} pointerEvents="box-none">
      {isSection ? (
        <>
          {/* The room inside a section stays empty room: you can pan through
              it, and the pieces resting on it are the ones a finger finds.
              The header is the handle, exactly as it looks. */}
          <Animated.View style={sizing} pointerEvents={editing ? "box-none" : "none"}>
            {body}
          </Animated.View>
          <GestureDetector gesture={handling}>
            <Animated.View style={[styles.grab, grabBar]} />
          </GestureDetector>
        </>
      ) : (
        <GestureDetector gesture={handling}>
          <Animated.View style={sizing}>{body}</Animated.View>
        </GestureDetector>
      )}

      {hot && (
        <View
          pointerEvents="none"
          style={[styles.hot, { borderColor: colors.zest, backgroundColor: alpha(colors.zest, 0.08) }]}
        />
      )}

      {selected && !editing && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, ring, { borderColor: alpha(colors.zest, 0.7) }]}
          />
          <GestureDetector gesture={rotate}>
            <Animated.View style={[styles.handle, styles.rotateAt, rotateKnob]}>
              <Knob colors={colors}>
                <RotateCw size={13} color={colors.inkMuted} />
              </Knob>
            </Animated.View>
          </GestureDetector>
          {item.kind !== "link" && (
            <GestureDetector gesture={resize}>
              <Animated.View style={[styles.handle, styles.resizeAt, resizeKnob]}>
                <Knob colors={colors}>
                  <Maximize2 size={13} color={colors.inkMuted} />
                </Knob>
              </Animated.View>
            </GestureDetector>
          )}
        </>
      )}
      </Animated.View>
    </Animated.View>
  );
});

function Knob({ colors, children }: { colors: Palette; children: React.ReactNode }) {
  return (
    <View
      style={[
        styles.knob,
        { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.9) },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Laid out at the viewport's own origin; the transform does the placing, so
  // the scale has to grow the piece away from its top-left corner rather than
  // its middle.
  item: { position: "absolute", left: 0, top: 0, transformOrigin: "0% 0%" },
  grab: { position: "absolute", left: 0, top: 0, height: SECTION_HEAD_H },
  ring: {
    position: "absolute",
    left: -6,
    top: -6,
    right: -6,
    bottom: -6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
  },
  hot: {
    position: "absolute",
    left: -2,
    top: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderRadius: SECTION_RADIUS,
  },
  handle: {
    position: "absolute",
    height: HANDLE,
    width: HANDLE,
    alignItems: "center",
    justifyContent: "center",
  },
  rotateAt: { top: -HANDLE - 8, left: "50%", marginLeft: -HANDLE / 2 },
  resizeAt: { bottom: -HANDLE / 2 - 4, right: -HANDLE / 2 - 4 },
  knob: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
});
