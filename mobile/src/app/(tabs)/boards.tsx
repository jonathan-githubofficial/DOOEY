import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DoodleSvg } from "@/components/DoodleSvg";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { useBoards, useCreateBoard, useDeleteBoard } from "@/features/boards/api";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** Boards: free-form mood boards. Name one below, then fill its canvas. */
export default function Boards() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: boards } = useBoards();
  const create = useCreateBoard();
  const del = useDeleteBoard();
  const [draft, setDraft] = useState("");

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    create.mutate(title);
    setDraft("");
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Masthead avatar={<PageDoodle page="boards" />} title="Boards" />

        <Panel style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Name a new board…"
            placeholderTextColor={alpha(colors.inkMuted, 0.6)}
            returnKeyType="done"
            submitBehavior="submit"
            style={[styles.composerInput, type.sans, { color: colors.ink }]}
          />
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="New board"
            onPress={add}
            disabled={!draft.trim()}
            style={[
              styles.composerAdd,
              { backgroundColor: alpha(colors.zest, 0.15) },
              !draft.trim() && { opacity: 0.4 },
            ]}
          >
            <Plus size={18} color={colors.zest} />
          </PressableScale>
        </Panel>

        <View style={styles.cards}>
          {(boards ?? []).map((b, i) => (
            <Animated.View key={b.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <PressableScale
                scaleTo={0.98}
                onPress={() => router.push(`/board/${b.id}`)}
                onLongPress={() =>
                  Alert.alert("Delete board", `Delete "${b.title}" and everything on it?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => del.mutate(b.id) },
                  ])
                }
              >
                <Panel style={styles.card}>
                  {b.doodle.length > 0 && (
                    <View style={styles.cardDoodle}>
                      <DoodleSvg strokes={b.doodle} />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text numberOfLines={1} style={[styles.cardTitle, type.display, { color: colors.ink }]}>
                      {b.title}
                    </Text>
                    <Text style={[styles.cardMeta, type.sans, { color: colors.inkMuted }]}>
                      {b.items.length === 0
                        ? "empty canvas"
                        : `${b.items.length} thing${b.items.length === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                </Panel>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  composer: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  composerInput: { flex: 1, fontSize: 15, paddingVertical: 6 },
  composerAdd: {
    height: 34,
    width: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  cards: { marginTop: 16, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 20,
  },
  cardDoodle: { height: 48, width: 48 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 19, letterSpacing: -0.3 },
  cardMeta: { marginTop: 2, fontSize: 12 },
});
