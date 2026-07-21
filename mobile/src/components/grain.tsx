import { Asset } from "expo-asset";
import { useState } from "react";
import { Image, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { useStyleStore } from "@/features/style/store";
import { useThemeStore } from "@/stores/theme";

const TILE = 160; // the noise PNGs' intrinsic size

/** The printed-paper texture: a tileable alpha-noise image over whatever this
 * is absolutely positioned against — the RN counterpart of the web app's
 * feTurbulence grain. Dark mode swaps black specks for white ones (the
 * multiply → overlay blend switch on the web).
 *
 * Tiling is platform-forked on purpose: react-native-web's <Image> ignores
 * resizeMode "repeat", native <Image> repeat is broken on new-architecture
 * iOS, and react-native-svg's <Pattern> fill won't rasterize an Image there
 * either — so web tiles via CSS background and native lays out a measured
 * grid of plain Image tiles (one shared bitmap, clipped to the corners). */
export function Grain({ radius = 0 }: { radius?: number }) {
  const dark = useThemeStore((s) => s.theme) === "dark";
  const strength = useStyleStore((s) => s.grain);
  const [size, setSize] = useState({ w: 0, h: 0 });
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

  const cols = Math.ceil(size.w / TILE);
  const rows = Math.ceil(size.h / TILE);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      style={[StyleSheet.absoluteFill, { opacity, borderRadius: radius, overflow: "hidden" }]}
    >
      {size.w > 0 &&
        Array.from({ length: rows * cols }, (_, i) => (
          <Image
            key={i}
            source={source}
            fadeDuration={0}
            style={{
              position: "absolute",
              left: (i % cols) * TILE,
              top: Math.floor(i / cols) * TILE,
              width: TILE,
              height: TILE,
            }}
          />
        ))}
    </View>
  );
}
