import { Asset } from "expo-asset";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Image, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { useStyleStore } from "@/features/style/store";
import { BACKDROPS } from "@/features/style/tokens";
import { alpha, type Palette } from "@/lib/theme";
import { usePalette, useThemeStore } from "@/stores/theme";

const TILE = 160; // the noise PNGs' intrinsic size

/** The chosen backdrop under the grain — only full-bleed page grain carries
 * it, never cards. A photo (blurred and faded into the paper) sits lowest,
 * then the whisper-quiet colour wash. */
function BackdropWash() {
  const colors = usePalette();
  const key = useStyleStore((s) => s.backdrop);
  const image = useStyleStore((s) => s.backdropImage);
  const blur = useStyleStore((s) => s.backdropBlur);
  const imgOpacity = useStyleStore((s) => s.backdropOpacity);
  const preset = BACKDROPS.find((b) => b.key === key);
  if (!preset && !image) return null;
  return (
    <>
      {image && (
        <Image
          source={{ uri: image }}
          resizeMode="cover"
          blurRadius={blur}
          style={[StyleSheet.absoluteFill, { opacity: imgOpacity }]}
        />
      )}
      {preset && (
        <LinearGradient
          pointerEvents="none"
          colors={[
            alpha(colors[preset.from as keyof Palette], 0.1),
            "transparent",
            alpha(colors[preset.to as keyof Palette], 0.09),
          ]}
          // Vertical, not diagonal: the colour at any screen row is the same
          // whatever the box width, so the wash lines up across the web
          // tablet-frame gutters and the centre column instead of only the
          // middle reading as "covered".
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </>
  );
}

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
export function Grain({ radius = 0, tone }: { radius?: number; tone?: "light" }) {
  const themeDark = useThemeStore((s) => s.theme) === "dark";
  const strength = useStyleStore((s) => s.grain);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // `tone="light"` pins the texture to the lit-wall look (login, gallery
  // gutters) whatever the app theme — and a pinned wall stays bare, no wash.
  const dark = tone === "light" ? false : themeDark;
  // Full-bleed page grain (radius 0) also carries the chosen backdrop wash.
  const wash = radius === 0 && !tone ? <BackdropWash /> : null;
  if (strength === 0) return wash;

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
      <>
        {wash}
        <View
          style={[
            StyleSheet.absoluteFill,
            { pointerEvents: "none", opacity, borderRadius: radius },
            tile,
          ]}
        />
      </>
    );
  }

  const cols = Math.ceil(size.w / TILE);
  const rows = Math.ceil(size.h / TILE);
  return (
    <>
      {wash}
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
    </>
  );
}
