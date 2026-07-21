import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Mask, Rect } from "react-native-svg";

const R = 3.5; // perforation radius — same numbers as the web's .stamp-edge
const S = 12; // spacing between perforations

/** The postage-stamp fill: a colored rect with notches punched along all four
 * sides via an SVG mask — the real perforation the web does with CSS masks.
 * Absolutely fills its parent; render it first, content on top. */
export function StampEdge({ color }: { color: string }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  const holes: { cx: number; cy: number }[] = [];
  if (w > 0 && h > 0) {
    for (let x = S / 2; x <= w; x += S) {
      holes.push({ cx: x, cy: 0 }, { cx: x, cy: h });
    }
    for (let y = S / 2; y <= h; y += S) {
      holes.push({ cx: 0, cy: y }, { cx: w, cy: y });
    }
  }

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {w > 0 && h > 0 && (
        <Svg width={w} height={h}>
          <Mask id="stamp">
            <Rect width={w} height={h} fill="#fff" />
            {holes.map((c, i) => (
              <Circle key={i} cx={c.cx} cy={c.cy} r={R} fill="#000" />
            ))}
          </Mask>
          <Rect width={w} height={h} fill={color} mask="url(#stamp)" />
        </Svg>
      )}
    </View>
  );
}
