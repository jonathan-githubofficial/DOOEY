import { Asset } from "expo-asset";
import { useState } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Image as SvgImage, Pattern, Rect } from "react-native-svg";
import { useStyleStore } from "@/features/style/store";
import { useThemeStore } from "@/stores/theme";

const TILE = 160; // the noise PNGs' intrinsic size

// Each Grain gets its own pattern id — several live on one screen at once.
let seq = 0;

/** The printed-paper texture: a tileable alpha-noise image over whatever this
 * is absolutely positioned against — the RN counterpart of the web app's
 * feTurbulence grain. Dark mode swaps black specks for white ones (the
 * multiply → overlay blend switch on the web).
 *
 * Tiling is platform-forked on purpose: react-native-web's <Image> ignores
 * resizeMode "repeat", and native <Image> repeat is broken on new-architecture
 * iOS — so web tiles via CSS background and native via an SVG pattern fill. */
export function Grain({ radius = 0 }: { radius?: number }) {
  const dark = useThemeStore((s) => s.theme) === "dark";
  const strength = useStyleStore((s) => s.grain);
  const [patternId] = useState(() => `grain-${++seq}`);
  if (strength === 0) return null;

  const source = dark
    ? require("../../assets/images/grain-dark.png")
    : require("../../assets/images/grain-light.png");
  const opacity = (dark ? 0.05 : 0.16) * strength;

  if (Platform.OS === "web") {
    const tile = {
      backgroundImage: `url(${Asset.fromModule(source).uri})`,
      backgroundRepeat: "repeat",
      backgroundSize: `${TILE}px ${TILE}px`,
    } as unknown as ViewStyle;
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { pointerEvents: "none", opacity, borderRadius: radius },
          tile,
        ]}
      />
    );
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={{ opacity }}>
        <Pattern id={patternId} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
          <SvgImage href={source} width={TILE} height={TILE} />
        </Pattern>
        <Rect width="100%" height="100%" rx={radius} fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}
