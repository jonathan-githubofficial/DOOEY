import { View } from "react-native";
import { DoodleSvg } from "@/components/DoodleSvg";
import { useStyleStore } from "../store";

/** The hand-drawn mark a page wears next to its title — drawn in the Style
 * studio. Renders nothing until one exists. */
export function PageDoodle({ page }: { page: string }) {
  const strokes = useStyleStore((s) => s.pageDoodles[page]);
  if (!strokes?.length) return null;
  return (
    <View style={{ height: 44, width: 44 }}>
      <DoodleSvg strokes={strokes} strokeWidth={2} />
    </View>
  );
}
