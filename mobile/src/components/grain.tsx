import { Image, StyleSheet, View } from "react-native";
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
  return (
    // The wrapper owns pointerEvents (an Image style can't) so the texture
    // never swallows a touch meant for the card under it.
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Image
        source={
          dark
            ? require("../../assets/images/grain-dark.png")
            : require("../../assets/images/grain-light.png")
        }
        resizeMode="repeat"
        style={[
          StyleSheet.absoluteFill,
          { opacity: (dark ? 0.05 : 0.16) * strength, borderRadius: radius },
        ]}
      />
    </View>
  );
}
