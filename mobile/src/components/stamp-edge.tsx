import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const R = 3.5; // perforation radius — same numbers as the web's .stamp-edge
const S = 12; // spacing between perforations

/** A circle as a path subpath — punched out of the rect by the evenodd fill.
 * (A single Path avoids SVG <Mask>, which react-native-svg renders wrong on
 * the web.) */
function hole(cx: number, cy: number): string {
  return `M${cx + R} ${cy} A${R} ${R} 0 1 0 ${cx - R} ${cy} A${R} ${R} 0 1 0 ${cx + R} ${cy} Z`;
}

/** The postage-stamp fill: a colored rect with notches punched along all four
 * sides — the real perforation the web does with CSS masks. Absolutely fills
 * its parent; render it first, content on top. */
export function StampEdge({ color }: { color: string }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  let d = "";
  if (w > 0 && h > 0) {
    d = `M0 0 H${w} V${h} H0 Z`;
    for (let x = S / 2; x <= w; x += S) {
      d += hole(x, 0) + hole(x, h);
    }
    for (let y = S / 2; y <= h; y += S) {
      d += hole(0, y) + hole(w, y);
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
      {!!d && (
        <Svg width={w} height={h}>
          <Path d={d} fill={color} fillRule="evenodd" />
        </Svg>
      )}
    </View>
  );
}
