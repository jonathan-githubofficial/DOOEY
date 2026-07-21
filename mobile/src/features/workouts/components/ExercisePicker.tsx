import { Dumbbell, Hash, Timer } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow } from "@/components/surface";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import type { ExerciseKind } from "../types";

const KINDS: { key: ExerciseKind; label: string; icon: typeof Dumbbell }[] = [
  { key: "weight_reps", label: "weight × reps", icon: Dumbbell },
  { key: "reps", label: "reps only", icon: Hash },
  { key: "duration", label: "timed hold", icon: Timer },
];

/** The exercise picker: type to filter everything you've ever planned or
 * logged, or name something new and pick how it's measured. */
export function ExercisePicker({
  visible,
  known,
  onPick,
  onClose,
}: {
  visible: boolean;
  known: string[];
  onPick: (name: string, kind: ExerciseKind) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ExerciseKind>("weight_reps");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return known;
    return known.filter((n) => n.toLowerCase().includes(q));
  }, [known, query]);

  const trimmed = query.trim();
  const isNew = trimmed.length > 0 && !known.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  const pick = (name: string, k: ExerciseKind) => {
    hapticTap();
    onPick(name, k);
    setQuery("");
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable onPress={() => {}} style={styles.cardWrap}>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Grain radius={20} />
              <Eyebrow>add exercise</Eyebrow>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Bench press, squat, plank…"
                placeholderTextColor={alpha(colors.inkMuted, 0.5)}
                autoFocus
                autoCorrect={false}
                style={[
                  styles.search,
                  type.sans,
                  { color: colors.ink, borderBottomColor: alpha(colors.ink, 0.18) },
                ]}
              />

              {isNew && (
                <>
                  <View style={styles.kinds}>
                    {KINDS.map((k) => {
                      const active = kind === k.key;
                      const Icon = k.icon;
                      return (
                        <PressableScale
                          key={k.key}
                          scaleTo={0.92}
                          accessibilityRole="button"
                          accessibilityLabel={k.label}
                          onPress={() => setKind(k.key)}
                          style={[
                            styles.kindChip,
                            {
                              backgroundColor: active ? alpha(colors.zest, 0.15) : colors.paper,
                              borderColor: active ? colors.zest : alpha(colors.rule, 0.8),
                            },
                          ]}
                        >
                          <Icon size={12} color={active ? colors.zest : colors.inkMuted} />
                          <Text
                            style={[
                              styles.kindLabel,
                              type.sansMedium,
                              { color: active ? colors.ink : colors.inkMuted },
                            ]}
                          >
                            {k.label}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                  <PressableScale
                    scaleTo={0.97}
                    accessibilityLabel={`Add ${trimmed}`}
                    onPress={() => pick(trimmed, kind)}
                    style={[styles.create, { backgroundColor: alpha(colors.zest, 0.12) }]}
                  >
                    <Text style={[styles.createText, type.sansMedium, { color: colors.ink }]}>
                      Add “{trimmed}”
                    </Text>
                  </PressableScale>
                </>
              )}

              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {matches.map((name) => (
                  <Pressable
                    key={name}
                    accessibilityLabel={name}
                    onPress={() => pick(name, "weight_reps")}
                    style={[styles.row, { borderBottomColor: alpha(colors.rule, 0.4) }]}
                  >
                    <Text style={[styles.rowText, type.sans, { color: colors.ink }]}>{name}</Text>
                  </Pressable>
                ))}
                {matches.length === 0 && !isNew && (
                  <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
                    Nothing logged yet — type a name to add your first exercise.
                  </Text>
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20, 16, 12, 0.35)",
  },
  cardWrap: {
    padding: 12,
  },
  card: {
    borderRadius: 20,
    padding: 16,
    maxHeight: 420,
    overflow: "hidden",
  },
  search: {
    marginTop: 10,
    borderBottomWidth: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  kinds: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  kindLabel: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  create: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  createText: {
    fontSize: 13.5,
  },
  list: {
    marginTop: 8,
  },
  row: {
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  rowText: {
    fontSize: 14.5,
  },
  empty: {
    paddingVertical: 16,
    fontSize: 12.5,
    textAlign: "center",
  },
});
