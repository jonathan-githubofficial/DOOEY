import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { fontStyle } from "@/features/style/tokens";
import { alpha, type Palette } from "@/lib/theme";
import { useType } from "@/stores/theme";
import {
  ASPECTS,
  NOTE_COLORS,
  SECTION_COLORS,
  STICKERS,
  TEXT_ALIGNS,
  TEXT_DEFAULTS,
  TEXT_FONTS,
  TEXT_WEIGHTS,
  type BoardItem,
  type PhotoFrame,
  type TextAlign,
} from "../types";

const ALIGN_ICON: Record<TextAlign, typeof AlignLeft> = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

const NEXT_FRAME: Record<PhotoFrame, PhotoFrame> = {
  plain: "polaroid",
  polaroid: "stamp",
  stamp: "plain",
};

/** Everything you can change about the selected piece, in one bar that is
 * always in the same place.
 *
 * The web hung these controls off each object. On a phone that fails twice:
 * the object is under your hand, and a piece near the bottom of the screen
 * pushes its own controls off it. A fixed bar above the shelf is reachable by
 * the same thumb every time and never covers the thing being changed.
 *
 * Delete lives here too, rather than as a small cross on the object, because a
 * 24pt target on a rotated sticker is a mis-tap waiting to happen. */
export function Inspector({
  item,
  colors,
  bottom,
  onPatch,
  onEdit,
  onDelete,
}: {
  item: BoardItem;
  colors: Palette;
  bottom: number;
  onPatch: (patch: Partial<BoardItem>) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const type = useType();

  return (
    <View style={[styles.host, { bottom }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          { backgroundColor: alpha(colors.surface, 0.96), borderColor: alpha(colors.rule, 0.7) },
        ]}
      >
        <Grain radius={999} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {item.kind === "note" &&
            NOTE_COLORS.map((c) => (
              <Swatch
                key={c}
                color={colors[c]}
                ring={colors.ink}
                on={item.color === c}
                label={`${c} note`}
                onPress={() => onPatch({ color: c })}
              />
            ))}

          {item.kind === "section" &&
            SECTION_COLORS.map((c) => (
              <Swatch
                key={c}
                color={colors[c]}
                ring={colors.ink}
                on={item.color === c}
                label={`${c} section`}
                onPress={() => onPatch({ color: c })}
              />
            ))}

          {item.kind === "sticker" &&
            STICKERS.map((emoji) => (
              <Pressable
                key={emoji}
                accessibilityLabel={`Use ${emoji}`}
                onPress={() => onPatch({ emoji })}
                style={[styles.emoji, item.emoji === emoji && { backgroundColor: alpha(colors.zest, 0.18) }]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}

          {item.kind === "text" && (
            <>
              {TEXT_FONTS.map((f) => {
                const family = f === "mono" ? "mono" : f === "body" ? "outfit" : "fraunces";
                const on = (item.font ?? TEXT_DEFAULTS.font) === f;
                return (
                  <Chip key={f} on={on} colors={colors} label={`${f} font`} onPress={() => onPatch({ font: f })}>
                    <Text
                      style={[
                        styles.chipText,
                        fontStyle(family, "700"),
                        { color: on ? colors.paper : colors.inkMuted },
                      ]}
                    >
                      Aa
                    </Text>
                  </Chip>
                );
              })}
              <Rule colors={colors} />
              {TEXT_WEIGHTS.map((w) => {
                const on = (item.weight ?? TEXT_DEFAULTS.weight) === w.value;
                return (
                  <Chip
                    key={w.value}
                    on={on}
                    colors={colors}
                    label={`${w.label} weight`}
                    onPress={() => onPatch({ weight: w.value })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        fontStyle("outfit", w.value >= 900 ? "900" : w.value >= 700 ? "700" : "400"),
                        { color: on ? colors.paper : colors.inkMuted },
                      ]}
                    >
                      {w.label}
                    </Text>
                  </Chip>
                );
              })}
              <Rule colors={colors} />
              {TEXT_ALIGNS.map((a) => {
                const on = (item.align ?? TEXT_DEFAULTS.align) === a;
                const Icon = ALIGN_ICON[a];
                return (
                  <Chip
                    key={a}
                    on={on}
                    colors={colors}
                    label={`Align ${a}`}
                    onPress={() => onPatch({ align: a })}
                  >
                    <Icon size={14} color={on ? colors.paper : colors.inkMuted} />
                  </Chip>
                );
              })}
            </>
          )}

          {item.kind === "photo" && (
            <>
              <Chip
                on
                colors={colors}
                label={`Frame: ${item.frame}, tap to change`}
                onPress={() => onPatch({ frame: NEXT_FRAME[item.frame] })}
              >
                <Text style={[styles.chipText, type.sansMedium, { color: colors.paper }]}>
                  {item.frame}
                </Text>
              </Chip>
              {item.frame !== "plain" && (
                <>
                  <Rule colors={colors} />
                  {ASPECTS.map((a) => (
                    <Chip
                      key={a.label}
                      on={Math.abs(item.aspect - a.value) < 0.02}
                      colors={colors}
                      label={`Crop ${a.label}`}
                      onPress={() => onPatch({ aspect: a.value })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          type.sansMedium,
                          {
                            color:
                              Math.abs(item.aspect - a.value) < 0.02 ? colors.paper : colors.inkMuted,
                          },
                        ]}
                      >
                        {a.label}
                      </Text>
                    </Chip>
                  ))}
                </>
              )}
            </>
          )}

          {item.kind === "link" && (
            <>
              {!!item.url && (
                <Chip
                  on={false}
                  colors={colors}
                  label="Open link"
                  onPress={() =>
                    void Linking.openURL(item.url.startsWith("http") ? item.url : `https://${item.url}`)
                  }
                >
                  <ExternalLink size={14} color={colors.sky} />
                  <Text style={[styles.chipText, type.sansMedium, { color: colors.ink }]}>Open</Text>
                </Chip>
              )}
              <Chip on={false} colors={colors} label="Edit link" onPress={onEdit}>
                <Pencil size={13} color={colors.inkMuted} />
                <Text style={[styles.chipText, type.sansMedium, { color: colors.inkMuted }]}>Edit</Text>
              </Chip>
            </>
          )}
        </ScrollView>

        <View style={[styles.tail, { borderLeftColor: alpha(colors.rule, 0.8) }]}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Delete piece"
            onPress={onDelete}
            style={styles.kill}
          >
            <Trash2 size={16} color={colors.clay} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function Swatch({
  color,
  ring,
  on,
  label,
  onPress,
}: {
  color: string;
  ring: string;
  on: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      scaleTo={0.82}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.swatch, { backgroundColor: color }, on && { borderWidth: 2, borderColor: alpha(ring, 0.45) }]}
    />
  );
}

function Chip({
  on,
  colors,
  label,
  onPress,
  children,
}: {
  on: boolean;
  colors: Palette;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      scaleTo={0.92}
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && { backgroundColor: colors.ink }]}
    >
      {children}
    </PressableScale>
  );
}

function Rule({ colors }: { colors: Palette }) {
  return <View style={[styles.divider, { backgroundColor: alpha(colors.rule, 0.9) }]} />;
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center", paddingHorizontal: 12 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingRight: 6 },
  swatch: { height: 24, width: 24, borderRadius: 999 },
  emoji: {
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  emojiText: { fontSize: 17 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: { fontSize: 11, textTransform: "capitalize" },
  divider: { marginHorizontal: 2, height: 16, width: 1 },
  tail: { borderLeftWidth: 1, paddingHorizontal: 4 },
  kill: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
});
