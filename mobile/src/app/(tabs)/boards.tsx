import { useRouter } from "expo-router";
import { MoreHorizontal, Plus } from "lucide-react-native";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { boardPhotoUrl, useBoards, useCreateBoard, useDeleteBoard } from "@/features/boards/api";
import type { BoardItem, Moodboard } from "@/features/boards/types";
import { useCardRadius } from "@/features/style/store";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { fontStyle } from "@/features/style/tokens";
import { strokePath } from "@/lib/doodle";
import { alpha, type Palette } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** The wall of boards: a folder-ish card per board — title, edit date, and a
 * fan of the board's actual pieces spilling up from the bottom edge — plus a
 * create tile. The exact web layout. */
export default function Boards() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const radius = useCardRadius();
  const { data: boards, isPending } = useBoards();
  const create = useCreateBoard();

  const newBoard = () =>
    create.mutate("Untitled board", {
      onSuccess: (r) => router.push(`/board/${r.id}`),
    });

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
      >
        <Masthead avatar={<PageDoodle page="boards" />} title="Boards" />

        <View style={styles.grid}>
          <PressableScale
            scaleTo={0.97}
            accessibilityLabel="New board"
            onPress={newBoard}
            disabled={create.isPending}
            style={[styles.newTile, { borderColor: alpha(colors.rule, 0.8), borderRadius: radius }]}
          >
            <Plus size={24} color={colors.inkMuted} />
            <Text style={[styles.newTileText, type.sansMedium, { color: colors.inkMuted }]}>
              New board
            </Text>
          </PressableScale>

          {(boards ?? []).map((b, i) => (
            <Animated.View key={b.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <BoardCard board={b} />
            </Animated.View>
          ))}

          {!isPending && boards?.length === 0 && (
            <Text style={[styles.emptyText, type.sans, { color: colors.inkMuted }]}>
              No boards yet — start one to collect ideas, images and links.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function BoardCard({ board }: { board: Moodboard }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const radius = useCardRadius();
  const del = useDeleteBoard();
  const tiles = pickFanTiles(board.items);
  const edited = new Date(board.updated).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });

  return (
    <PressableScale scaleTo={0.99} onPress={() => router.push(`/board/${board.id}`)}>
      <Panel style={styles.card}>
        {/* Everything clips inside the card — the fan bleeds off its bottom. */}
        <View style={[styles.cardClip, { borderRadius: radius - 1 }]}>
          <Text
            numberOfLines={1}
            style={[styles.cardTitle, type.display, { color: colors.ink }]}
          >
            {board.title}
          </Text>
          <Text style={[styles.cardMeta, type.sans, { color: colors.inkMuted }]}>
            Edited {edited}
          </Text>

          <View style={styles.fanArea} pointerEvents="none">
            {tiles.length === 0 ? (
              <Text style={[styles.emptyStar, { color: alpha(colors.inkMuted, 0.2) }]}>✦</Text>
            ) : (
              tiles.map((t, i) => (
                <FanTile key={t.id} item={t} boardId={board.id} index={i} count={tiles.length} colors={colors} />
              ))
            )}
          </View>
        </View>
        <Pressable
          accessibilityLabel="Board options"
          hitSlop={6}
          onPress={() =>
            Alert.alert(board.title, undefined, [
              {
                text: "Delete board",
                style: "destructive",
                onPress: () => del.mutate(board.id),
              },
              { text: "Cancel", style: "cancel" },
            ])
          }
          style={styles.menuBtn}
        >
          <MoreHorizontal size={16} color={colors.inkMuted} />
        </Pressable>
      </Panel>
    </PressableScale>
  );
}

/** Up to three pieces for the card's fan — photos first, then the rest.
 * Items tucked inside folders and section frames don't make the cut. */
function pickFanTiles(items: BoardItem[]): BoardItem[] {
  const order = { photo: 0, note: 1, doodle: 2, group: 3, sticker: 4, text: 5, link: 6, section: 7 };
  return [...items]
    .filter((i) => !i.parent && i.kind !== "section")
    .sort((a, b) => order[a.kind] - order[b.kind])
    .slice(0, 3);
}

/** One card in the fan: rotated, overlapping, bleeding off the bottom. */
function FanTile({
  item,
  boardId,
  index,
  count,
  colors,
}: {
  item: BoardItem;
  boardId: string;
  index: number;
  count: number;
  colors: Palette;
}) {
  const spread = index - (count - 1) / 2;
  return (
    <View
      style={[
        styles.fanTile,
        {
          left: `${28 + spread * 22}%`,
          bottom: `${-10 - Math.abs(spread) * 2}%`,
          zIndex: index,
          aspectRatio: item.kind === "sticker" ? 1 : 4 / 3,
          backgroundColor: colors.surface,
          transform: [{ rotate: `${spread * 10}deg` }],
        },
      ]}
    >
      <FanContent item={item} boardId={boardId} colors={colors} />
    </View>
  );
}

function FanContent({ item, boardId, colors }: { item: BoardItem; boardId: string; colors: Palette }) {
  switch (item.kind) {
    case "photo":
      return (
        <Image source={{ uri: boardPhotoUrl(boardId, item.file) }} style={styles.fanFill} resizeMode="cover" />
      );
    case "note":
      return (
        <View style={[styles.fanFill, styles.fanPad, { backgroundColor: alpha(colors[item.color], 0.5) }]}>
          <Text numberOfLines={3} style={[styles.fanSmallText, fontStyle("outfit", "400"), { color: alpha(colors.ink, 0.8) }]}>
            {item.text || "Note"}
          </Text>
        </View>
      );
    case "group":
      return (
        <View style={[styles.fanFill, styles.fanCenter]}>
          <Text style={[styles.fanLabel, fontStyle("outfit", "600"), { color: colors.inkMuted }]}>
            {item.label || "Folder"}
          </Text>
        </View>
      );
    case "text":
      return (
        <View style={[styles.fanFill, styles.fanPad, styles.fanMiddle]}>
          <Text numberOfLines={3} style={[styles.fanText, fontStyle("fraunces", "700"), { color: colors.ink }]}>
            {item.text || "Text"}
          </Text>
        </View>
      );
    case "sticker":
      return (
        <View style={[styles.fanFill, styles.fanCenter]}>
          <Text style={styles.fanEmoji}>{item.emoji}</Text>
        </View>
      );
    case "doodle": {
      const w = item.aspect < 1 ? 48 * item.aspect : 48;
      return (
        <View style={[styles.fanFill, styles.fanCenter]}>
          <Svg width={w} height={w / item.aspect} viewBox={`0 0 100 ${100 / item.aspect}`}>
            {item.strokes.map((s, i) => (
              <Path
                key={i}
                d={strokePath(s.points)}
                fill="none"
                stroke={colors[s.color as keyof Palette] ?? colors.ink}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ))}
          </Svg>
        </View>
      );
    }
    case "link":
      return (
        <View style={[styles.fanFill, styles.fanPad, styles.fanMiddle, { backgroundColor: alpha(colors.sky, 0.1) }]}>
          <Text numberOfLines={2} style={[styles.fanSmallText, fontStyle("outfit", "500"), { color: colors.ink }]}>
            {item.label || "Link"}
          </Text>
        </View>
      );
    case "section":
      return null;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  grid: { marginTop: 24, gap: 16 },
  newTile: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  newTileText: { fontSize: 14 },
  emptyText: { marginTop: 8, fontSize: 14 },
  card: { aspectRatio: 16 / 9, padding: 0 },
  cardClip: {
    flex: 1,
    overflow: "hidden",
    padding: 16,
  },
  cardTitle: { maxWidth: "75%", fontSize: 18, letterSpacing: -0.3 },
  cardMeta: { marginTop: 2, fontSize: 12 },
  menuBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  fanArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: "42%",
  },
  emptyStar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    textAlign: "center",
    fontSize: 30,
  },
  fanTile: {
    position: "absolute",
    width: "38%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    overflow: "hidden",
    shadowColor: "#282018",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  fanFill: { flex: 1 },
  fanPad: { padding: 8 },
  fanCenter: { alignItems: "center", justifyContent: "center" },
  fanMiddle: { justifyContent: "center" },
  fanSmallText: { fontSize: 9, lineHeight: 12 },
  fanText: { fontSize: 11, lineHeight: 13, letterSpacing: -0.2 },
  fanLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: "uppercase" },
  fanEmoji: { fontSize: 30 },
});
