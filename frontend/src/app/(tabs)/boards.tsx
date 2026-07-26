import { useRouter } from "expo-router";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DotsButton } from "@/components/dots-button";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import {
  boardPhotoUrl,
  useBoards,
  useCreateBoard,
  useDeleteBoard,
  useRenameBoard,
} from "@/features/boards/api";
import { DoodleArt } from "@/features/boards/components/ItemBody";
import type { BoardItem, Moodboard } from "@/features/boards/types";
import { useCardRadius } from "@/features/style/store";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { fontStyle } from "@/features/style/tokens";
import { confirmDestructive } from "@/lib/confirm";
import { alpha, type Palette } from "@/lib/theme";
import { openPrompt, type Menu } from "@/stores/sheet";
import { useElevation, usePalette, useType } from "@/stores/theme";
import { useLiveBarInset } from "@/features/workouts/live-bar";

const GUTTER = 16;
const GAP = 12;

/** How many boards sit side by side. Two on a phone, three once there is
 * genuinely room for them: a card narrower than about a thumb stops showing
 * enough of the board to be worth tapping. */
function columnsFor(width: number): number {
  return width >= 900 ? 3 : 2;
}

/** The wall of boards: a card per board — title, edit date, and a fan of the
 * board's actual pieces spilling up from the bottom edge — plus a create tile. */
export default function Boards() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const liveInset = useLiveBarInset();
  const router = useRouter();
  const radius = useCardRadius();
  const { width } = useWindowDimensions();
  const { data: boards, isPending } = useBoards();
  const create = useCreateBoard();

  const cols = columnsFor(width);
  const cardW = (width - GUTTER * 2 - GAP * (cols - 1)) / cols;

  const newBoard = () =>
    create.mutate("Untitled board", {
      onSuccess: (r) => router.push(`/board/${r.id}`),
    });

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      {/* Pinned above the scroller: the space's name stays put while its
          contents run under it. */}
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="boards" />} title="Boards" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 + liveInset },
        ]}
      >
        <View style={styles.grid}>
          <PressableScale
            scaleTo={0.97}
            accessibilityLabel="New board"
            onPress={newBoard}
            disabled={create.isPending}
            style={[
              styles.newTile,
              { width: cardW, borderColor: alpha(colors.rule, 0.8), borderRadius: radius },
            ]}
          >
            <Plus size={22} color={colors.inkMuted} />
            <Text style={[styles.newTileText, type.sansMedium, { color: colors.inkMuted }]}>
              New board
            </Text>
          </PressableScale>

          {/* No entrance animation. A staggered wave across a grid explains
              nothing — the cards were never anywhere else — and it puts a
              delay in front of the one thing this screen is for. */}
          {(boards ?? []).map((b) => (
            <BoardCard key={b.id} board={b} width={cardW} />
          ))}
        </View>

        {!isPending && boards?.length === 0 && (
          <Text style={[styles.emptyText, type.sans, { color: colors.inkMuted }]}>
            No boards yet — start one to collect ideas, images and links.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function BoardCard({ board, width }: { board: Moodboard; width: number }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const radius = useCardRadius();
  const del = useDeleteBoard();
  const rename = useRenameBoard();
  const tiles = pickFanTiles(board.items);
  const edited = new Date(board.updated).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });

  const menu = (): Menu => ({
    title: board.title,
    actions: [
      {
        label: "Rename",
        symbol: "pencil",
        icon: <Pencil size={17} color={colors.ink} />,
        onPress: () =>
          openPrompt({
            title: "Rename board",
            initial: board.title,
            placeholder: "Board name",
            confirmLabel: "Save",
            onSubmit: (title) => rename.mutate({ id: board.id, title }),
          }),
      },
      {
        label: "Delete board",
        symbol: "trash",
        destructive: true,
        icon: <Trash2 size={17} color={colors.clay} />,
        onPress: () =>
          confirmDestructive(
            `Delete “${board.title}”?`,
            "The board and every piece pinned to it go for good.",
            "Delete board",
            () => del.mutate(board.id),
          ),
      },
    ],
  });

  return (
    <PressableScale scaleTo={0.99} onPress={() => router.push(`/board/${board.id}`)}>
      <Panel style={[styles.card, { width }]}>
        {/* Everything clips inside the card — the fan bleeds off its bottom. */}
        <View style={[styles.cardClip, { borderRadius: radius - 1 }]}>
          <Text numberOfLines={1} style={[styles.cardTitle, type.display, { color: colors.ink }]}>
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
                <FanTile
                  key={t.id}
                  item={t}
                  boardId={board.id}
                  index={i}
                  count={tiles.length}
                  colors={colors}
                />
              ))
            )}
          </View>
        </View>
        <DotsButton label={`${board.title} options`} menu={menu} style={styles.menuBtn} />
      </Panel>
    </PressableScale>
  );
}

/** Up to three pieces for the card's fan — photos first, then the rest.
 * Section frames don't make the cut: they are the room, not the furniture. */
function pickFanTiles(items: BoardItem[]): BoardItem[] {
  const order = { photo: 0, note: 1, doodle: 2, sticker: 3, text: 4, link: 5, section: 6 };
  return [...items]
    .filter((i) => i.kind !== "section")
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
  const elevation = useElevation();
  const spread = index - (count - 1) / 2;
  return (
    <View
      style={[
        styles.fanTile,
        elevation,
        {
          left: `${28 + spread * 22}%`,
          bottom: `${-10 - Math.abs(spread) * 2}%`,
          zIndex: index,
          aspectRatio: item.kind === "sticker" ? 1 : 4 / 3,
          backgroundColor: colors.surface,
          borderColor: alpha(colors.ink, 0.06),
          transform: [{ rotate: `${spread * 10}deg` }],
        },
      ]}
    >
      <FanContent item={item} boardId={boardId} colors={colors} />
    </View>
  );
}

function FanContent({
  item,
  boardId,
  colors,
}: {
  item: BoardItem;
  boardId: string;
  colors: Palette;
}) {
  switch (item.kind) {
    case "photo":
      return item.file ? (
        <Image
          source={{ uri: boardPhotoUrl(boardId, item.file) }}
          style={styles.fanFill}
          resizeMode="cover"
        />
      ) : null;
    case "note":
      return (
        <View
          style={[styles.fanFill, styles.fanPad, { backgroundColor: alpha(colors[item.color], 0.5) }]}
        >
          <Text
            numberOfLines={3}
            style={[styles.fanSmallText, fontStyle("outfit", "400"), { color: alpha(colors.ink, 0.8) }]}
          >
            {item.text || "Note"}
          </Text>
        </View>
      );
    case "text":
      return (
        <View style={[styles.fanFill, styles.fanPad, styles.fanMiddle]}>
          <Text
            numberOfLines={3}
            style={[styles.fanText, fontStyle("fraunces", "700"), { color: colors.ink }]}
          >
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
    case "doodle":
      return (
        <View style={[styles.fanFill, styles.fanCenter]}>
          <DoodleArt
            strokes={item.strokes}
            aspect={item.aspect}
            width={item.aspect < 1 ? 44 * item.aspect : 44}
            strokeWidth={4}
          />
        </View>
      );
    case "link":
      return (
        <View
          style={[
            styles.fanFill,
            styles.fanPad,
            styles.fanMiddle,
            { backgroundColor: alpha(colors.sky, 0.1) },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[styles.fanSmallText, fontStyle("outfit", "500"), { color: colors.ink }]}
          >
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
  head: { paddingHorizontal: GUTTER },
  scrollContent: { paddingHorizontal: GUTTER },
  grid: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  newTile: {
    aspectRatio: 4 / 3,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  newTileText: { fontSize: 13 },
  emptyText: { marginTop: 16, fontSize: 14 },
  card: { aspectRatio: 4 / 3, padding: 0 },
  cardClip: { flex: 1, overflow: "hidden", padding: 14 },
  cardTitle: { maxWidth: "76%", fontSize: 16, letterSpacing: -0.3 },
  cardMeta: { marginTop: 2, fontSize: 11 },
  menuBtn: {
    position: "absolute",
    right: 8,
    top: 8,
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  fanArea: { position: "absolute", left: 0, right: 0, bottom: 0, top: "44%" },
  emptyStar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 20,
    textAlign: "center",
    fontSize: 28,
  },
  fanTile: {
    position: "absolute",
    width: "40%",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  fanFill: { flex: 1 },
  fanPad: { padding: 7 },
  fanCenter: { alignItems: "center", justifyContent: "center" },
  fanMiddle: { justifyContent: "center" },
  fanSmallText: { fontSize: 9, lineHeight: 12 },
  fanText: { fontSize: 11, lineHeight: 13, letterSpacing: -0.2 },
  fanEmoji: { fontSize: 26 },
});
