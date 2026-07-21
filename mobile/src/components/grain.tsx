import { Asset } from "expo-asset";
import { Image, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { useStyleStore } from "@/features/style/store";
import { useThemeStore } from "@/stores/theme";

/** The printed-paper texture: a tileable alpha-noise image over whatever this
 * is absolutely positioned against — the RN counterpart of the web app's
 * feTurbulence grain. Dark mode swaps black specks for white ones (the
 * multiply → overlay blend switch on the web). */
export function Grain({ radius = 0 }: { radius?: number }) {
  const dark = useThemeStore((s) => s.theme) === "dark";
  const strength = useStyleStore((s) => s.grain);
  if (strength === 0) return null;

  const source = dark
    ? require("../../assets/images/grain-dark.png")
    : require("../../assets/images/grain-light.png");
  const opacity = (dark ? 0.05 : 0.16) * strength;

  if (Platform.OS === "web") {
    // react-native-web's <Image> can't tile — resizeMode "repeat" paints one
    // 160px square in the corner — so on web the texture is a CSS background.
    const tile = {
      backgroundImage: `url(${Asset.fromModule(source).uri})`,
      backgroundRepeat: "repeat",
      backgroundSize: "160px 160px",
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
    // The wrapper owns pointerEvents (an Image style can't) so the texture
    // never swallows a touch meant for the card under it.
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Image
        source={source}
        resizeMode="repeat"
        style={[StyleSheet.absoluteFill, { opacity, borderRadius: radius }]}
      />
    </View>
  );
}
