import { Check, Eraser, Pencil, Undo2, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, type GestureResponderEvent } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { DoodleSvg } from "@/components/DoodleSvg";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow } from "@/components/surface";
import { INK_COLORS, touchPct, type InkColor, type Stroke } from "@/lib/doodle";
import { alpha, type Palette } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** How close (in % of the pad) the eraser has to pass to a point to remove it. */
const ERASE_RADIUS = 5;

/** Remove any part of any stroke within `radius` of (x, y). A stroke erased in
 * the middle splits into two — this is what makes it feel like a real eraser
 * instead of an all-or-nothing "clear". Runs of a single leftover point (which
 * can't render a line) are dropped. */
function eraseNear(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const result: Stroke[] = [];
  for (const s of strokes) {
    let run: [number, number][] = [];
    for (const p of s.points) {
      if (Math.hypot(p[0] - x, p[1] - y) > radius) {
        run.push(p);
      } else {
        if (run.length > 1) result.push({ color: s.color, points: run });
        run = [];
      }
    }
    if (run.length > 1) result.push({ color: s.color, points: run });
  }
  return result;
}

/** The little drawing card: pad, four inks, pen/eraser/undo, save. The parent
 * decides where it lives (typically inside a Modal). */
export function DoodleEditor({
  heading,
  initial,
  onSave,
  onClose,
}: {
  heading: string;
  initial: Stroke[];
  onSave: (strokes: Stroke[]) => void | Promise<void>;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const [live, setLive] = useState<[number, number][] | null>(null);
  const [ink, setInk] = useState<InkColor>("ink");
  const [tool, setTool] = useState<"pen" | "erase">("pen");
  const [eraserAt, setEraserAt] = useState<[number, number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [padSize, setPadSize] = useState(0);

  // Undo restores whole gestures (one full stroke, or one erase drag), not
  // individual points — a ref keeps the pre-gesture snapshot without forcing
  // a re-render on every touch move.
  const [history, setHistory] = useState<Stroke[][]>([]);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const gestureStart = useRef<Stroke[] | null>(null);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setStrokes(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  const touchAt = (e: GestureResponderEvent): [number, number] =>
    touchPct(e.nativeEvent.locationX, e.nativeEvent.locationY, padSize);

  const onGrant = (e: GestureResponderEvent) => {
    const p = touchAt(e);
    if (tool === "pen") {
      setLive([p]);
    } else {
      gestureStart.current = strokesRef.current;
      setEraserAt(p);
      setStrokes(eraseNear(strokesRef.current, p[0], p[1], ERASE_RADIUS));
    }
  };

  const onMove = (e: GestureResponderEvent) => {
    const p = touchAt(e);
    if (tool === "pen") {
      setLive((l) => {
        if (!l) return l;
        const last = l[l.length - 1];
        return Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 0.6 ? [...l, p] : l;
      });
    } else if (gestureStart.current) {
      setEraserAt(p);
      setStrokes((s) => eraseNear(s, p[0], p[1], ERASE_RADIUS));
    }
  };

  const onRelease = () => {
    if (tool === "pen") {
      if (live && live.length > 1) {
        setHistory((h) => [...h, strokesRef.current].slice(-20));
        setStrokes([...strokesRef.current, { color: ink, points: live }]);
      }
      setLive(null);
    } else if (gestureStart.current) {
      // Only a real change earns an undo step — tapping empty space stays silent.
      if (gestureStart.current !== strokesRef.current) {
        setHistory((h) => [...h, gestureStart.current!].slice(-20));
      }
      gestureStart.current = null;
    }
    setEraserAt(null);
  };

  return (
    <Animated.View
      entering={ZoomIn.springify().stiffness(480).damping(24)}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
      ]}
    >
      <Grain radius={15} />
      <Eyebrow>{heading}</Eyebrow>

      <View
        style={[styles.pad, { backgroundColor: colors.paper, borderColor: alpha(colors.rule, 0.7) }]}
        onLayout={(e) => setPadSize(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => padSize > 0}
        onMoveShouldSetResponder={() => padSize > 0}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
      >
        <DoodleSvg strokes={live && live.length > 1 ? [...strokes, { color: ink, points: live }] : strokes} />
        {tool === "erase" && eraserAt && padSize > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.eraserDot,
              {
                left: `${eraserAt[0] - ERASE_RADIUS}%`,
                top: `${eraserAt[1] - ERASE_RADIUS}%`,
                width: `${ERASE_RADIUS * 2}%`,
                height: `${ERASE_RADIUS * 2}%`,
                borderColor: alpha(colors.ink, 0.5),
                backgroundColor: alpha(colors.ink, 0.1),
              },
            ]}
          />
        )}
      </View>

      <View style={styles.toolbar}>
        <View style={styles.inks}>
          {tool === "pen" ? (
            INK_COLORS.map((c) => (
              <PressableScale
                key={c}
                scaleTo={0.8}
                accessibilityLabel={`${c} ink`}
                onPress={() => setInk(c)}
                style={[
                  styles.inkDot,
                  { backgroundColor: colors[c as keyof Palette] },
                  ink === c && { borderWidth: 2, borderColor: alpha(colors.ink, 0.3) },
                ]}
              />
            ))
          ) : (
            <Text style={[styles.erasingLabel, type.sansMedium, { color: colors.inkMuted }]}>
              erasing
            </Text>
          )}
        </View>
        <View style={styles.tools}>
          <MiniTool label="Pen" active={tool === "pen"} onPress={() => setTool("pen")}>
            <Pencil size={14} color={tool === "pen" ? colors.zest : colors.inkMuted} />
          </MiniTool>
          <MiniTool label="Eraser" active={tool === "erase"} onPress={() => setTool("erase")}>
            <Eraser size={14} color={tool === "erase" ? colors.zest : colors.inkMuted} />
          </MiniTool>
          <MiniTool label="Undo" disabled={history.length === 0} onPress={undo}>
            <Undo2 size={14} color={colors.inkMuted} />
          </MiniTool>
          <MiniTool label="Cancel" onPress={onClose}>
            <X size={14} color={colors.inkMuted} />
          </MiniTool>
          <MiniTool
            label="Save doodle"
            accent
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              try {
                await onSave(strokes);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check size={14} color={colors.leaf} />
          </MiniTool>
        </View>
      </View>
    </Animated.View>
  );
}

function MiniTool({
  label,
  active,
  accent,
  disabled,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      scaleTo={0.85}
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.miniTool,
        active && { backgroundColor: alpha(colors.zest, 0.15) },
        accent && { backgroundColor: alpha(colors.leaf, 0.15) },
        disabled && { opacity: 0.4 },
      ]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 264,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#282018",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pad: {
    marginTop: 8,
    aspectRatio: 1,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  eraserDot: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
  },
  toolbar: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 8,
  },
  inks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inkDot: {
    height: 16,
    width: 16,
    borderRadius: 999,
  },
  erasingLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  miniTool: {
    height: 28,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
});
