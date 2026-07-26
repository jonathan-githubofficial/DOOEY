import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useBoard } from "@/features/boards/api";
import { BoardCanvas } from "@/features/boards/components/BoardCanvas";
import { usePalette } from "@/stores/theme";

export default function BoardPage() {
  const colors = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: board } = useBoard(id);

  if (!board) return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  return <BoardCanvas board={board} />;
}
