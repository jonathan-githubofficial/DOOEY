import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const R = 3.5; // perforation radius — same numbers as the web's .stamp-edge
const S = 12; // spacing between perforations

// The legacy web app's exact perforation mask: a repeating notch punched
// along each edge, the four layers intersected.
const MASK = [
  `radial-gradient(${R}px at 50% 0, #0000 98%, #000) 50% 0 / ${S}px 100% repeat-x`,
  `radial-gradient(${R}px at 50% 100%, #0000 98%, #000) 50% 100% / ${S}px 100% repeat-x`,
  `radial-gradient(${R}px at 0 50%, #0000 98%, #000) 0 50% / 100% ${S}px repeat-y`,
  `radial-gradient(${R}px at 100% 50%, #0000 98%, #000) 100% 50% / 100% ${S}px repeat-y`,
].join(", ");

/** A circle as a path subpath — punched out of the rect by the evenodd fill. */
function hole(cx: number, cy: number): string {
  return `M${cx + R} ${cy} A${R} ${R} 0 1 0 ${cx - R} ${cy} A${R} ${R} 0 1 0 ${cx + R} ${cy} Z`;
}

/** react-native-web whitelists style properties and silently drops `mask`,
 * so the legacy perforation is written straight onto the DOM node. */
function WebStampEdge({ color }: { color: string }) {
  const ref = useRef<View>(null);
  useEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el?.style) return;
    // Shorthand first — it resets composite — then the composite mode
    // (Chrome wants the legacy keyword, the standard wants intersect).
    el.style.setProperty("-webkit-mask", MASK);
    el.style.setProperty("-webkit-mask-composite", "source-in");
    el.style.setProperty("mask", MASK);
    el.style.setProperty("mask-composite", "intersect");
  }, []);
  return (
    <View
      ref={ref}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color }]}
    />
  );
}

/** The postage-stamp fill: a colored rect with notches punched along all four
 * sides. On the web it IS the legacy stamp — the same CSS mask — which also
 * keeps the corners crisp; native builds the perforations as one evenodd SVG
 * path. Absolutely fills its parent; render it first, content on top. */
export function StampEdge({ color }: { color: string }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;

  if (Platform.OS === "web") {
    return <WebStampEdge color={color} />;
  }

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
