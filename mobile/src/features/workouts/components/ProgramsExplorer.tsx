import { ChevronLeft, ChevronRight, Play, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { exerciseGif, libraryExercise } from "../library";
import { PROGRAMS, type Program, type ProgramRoutine } from "../programs";

/** Explore programs: browse the famous splits, open one to see its routines,
 * then start a routine (→ the log page) or add the whole program to your gym. */
export function ProgramsExplorer({
  visible,
  onStartRoutine,
  onAddProgram,
  onClose,
}: {
  visible: boolean;
  onStartRoutine: (routine: ProgramRoutine) => void;
  onAddProgram: (program: Program) => void;
  onClose: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<Program | null>(null);

  const close = () => {
    setOpen(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={() => (open ? setOpen(null) : close())}
    >
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.paper, paddingTop: Platform.OS === "ios" ? 14 : insets.top + 14 },
        ]}
      >
        <Grain />
        <View style={styles.head}>
          <Eyebrow>programs</Eyebrow>
          <PressableScale scaleTo={0.85} accessibilityLabel="Close" onPress={close} style={styles.close}>
            <X size={18} color={colors.inkMuted} />
          </PressableScale>
        </View>
        <Text style={[styles.blurb, type.sans, { color: colors.inkMuted }]}>
          Proven training splits. Open one to see its routines — start a day now, or add the whole
          program to your gym.
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: insets.bottom + 24 }}
        >
          {PROGRAMS.map((p, idx) => (
            <PressableScale
              key={p.key}
              scaleTo={0.98}
              accessibilityLabel={p.name}
              onPress={() => {
                hapticTap();
                setOpen(p);
              }}
            >
              <Panel style={styles.programCard}>
                <View style={styles.programTopRow}>
                  <View style={styles.programText}>
                    <Text style={[styles.programName, type.display, { color: colors.ink }]}>
                      {p.name}
                    </Text>
                    <Text style={[styles.programSplit, type.sansMedium, { color: colors.zest }]}>
                      {p.split}
                    </Text>
                  </View>
                  <View style={[styles.daysBadge, { backgroundColor: alpha(colors.zest, 0.14) }]}>
                    <Text style={[styles.daysNum, fontStyle("fraunces", "700"), { color: colors.zest }]}>
                      {p.days.split(/[\s–-]/)[0]}
                    </Text>
                    <Text style={[styles.daysUnit, type.sansMedium, { color: colors.zest }]}>days</Text>
                  </View>
                </View>

                <ProgramStrip program={p} accent={idx} />

                <View style={styles.programFootRow}>
                  <Text numberOfLines={1} style={[styles.programMeta, type.sans, { color: colors.inkMuted }]}>
                    {p.routines.length} routines · {p.bestFor}
                  </Text>
                  <ChevronRight size={16} color={colors.inkMuted} />
                </View>
              </Panel>
            </PressableScale>
          ))}
        </ScrollView>

        {open && (
          <ProgramDetail
            program={open}
            onStartRoutine={(r) => {
              onStartRoutine(r);
              close();
            }}
            onAdd={() => {
              onAddProgram(open);
              close();
            }}
            onBack={() => setOpen(null)}
          />
        )}
      </View>
    </Modal>
  );
}

function ProgramDetail({
  program,
  onStartRoutine,
  onAdd,
  onBack,
}: {
  program: Program;
  onStartRoutine: (r: ProgramRoutine) => void;
  onAdd: () => void;
  onBack: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={FadeIn.duration(160)}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.paper }]}
    >
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.detail, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={styles.detailHead}>
          <PressableScale scaleTo={0.85} accessibilityLabel="Back to programs" onPress={onBack} style={styles.close}>
            <ChevronLeft size={20} color={colors.inkMuted} />
          </PressableScale>
          <View style={styles.detailTitleText}>
            <Text style={[styles.detailName, fontStyle("fraunces", "900"), { color: colors.ink }]}>
              {program.name}
            </Text>
            <Text style={[styles.programMeta, type.sans, { color: colors.inkMuted }]}>
              {program.days} · {program.bestFor}
            </Text>
          </View>
        </View>

        <Text style={[styles.detailBlurb, type.sans, { color: colors.inkMuted }]}>
          {program.description}
        </Text>

        <Eyebrow style={styles.routinesHead}>{program.routines.length} routines</Eyebrow>
        <View style={styles.routineList}>
          {program.routines.map((r) => (
            <Pressable
              key={r.name}
              accessibilityLabel={`Start ${r.name}`}
              onPress={() => {
                hapticTap();
                onStartRoutine(r);
              }}
            >
              <Panel style={styles.routineRow}>
                <RoutineFan routine={r} />
                <View style={styles.routineRowText}>
                  <Text numberOfLines={1} style={[styles.routineName, type.sansSemiBold, { color: colors.ink }]}>
                    {r.name}
                  </Text>
                  <Text numberOfLines={2} style={[styles.routineExs, type.sans, { color: colors.inkMuted }]}>
                    {r.items.map((i) => i.name).join(", ")}
                  </Text>
                </View>
                <View style={[styles.routinePlay, { backgroundColor: alpha(colors.zest, 0.14) }]}>
                  <Play size={14} color={colors.zest} />
                </View>
              </Panel>
            </Pressable>
          ))}
        </View>

        <View style={styles.addRow}>
          <Plate label="Add program to my gym" onPress={onAdd} style={styles.addPlate} />
          <View style={styles.addHintRow}>
            <Plus size={12} color={colors.inkMuted} />
            <Text style={[styles.addHint, type.sans, { color: colors.inkMuted }]}>
              Saves all {program.routines.length} routines to My routines.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

/** A strip of the program's exercise demos — a visual taste of what's inside. */
function ProgramStrip({ program }: { program: Program; accent: number }) {
  const colors = usePalette();
  const type = useType();
  const seen = new Set<string>();
  const gifs: string[] = [];
  for (const r of program.routines) {
    for (const it of r.items) {
      if (it.libId && !seen.has(it.libId)) {
        seen.add(it.libId);
        const ex = libraryExercise(it.libId);
        if (ex) gifs.push(exerciseGif(ex));
      }
      if (gifs.length >= 5) break;
    }
    if (gifs.length >= 5) break;
  }
  const total = new Set(program.routines.flatMap((r) => r.items.map((i) => i.libId ?? i.name))).size;
  return (
    <View style={styles.strip}>
      {gifs.map((uri, i) => (
        <Image
          key={i}
          source={{ uri }}
          resizeMode="cover"
          style={[styles.stripPhoto, { borderColor: alpha(colors.rule, 0.6) }]}
        />
      ))}
      {total > gifs.length && (
        <View style={[styles.stripMore, { backgroundColor: alpha(colors.ink, 0.06) }]}>
          <Text style={[styles.stripMoreText, type.sansMedium, { color: colors.inkMuted }]}>
            +{total - gifs.length}
          </Text>
        </View>
      )}
    </View>
  );
}

/** Up to three demo loops, fanned — the same tactile move as the board cards. */
function RoutineFan({ routine }: { routine: ProgramRoutine }) {
  const colors = usePalette();
  const gifs = routine.items
    .map((i) => libraryExercise(i.libId))
    .filter((e) => !!e)
    .slice(0, 3);
  if (gifs.length === 0) return <View style={styles.fanSlot} />;
  return (
    <View style={styles.fanSlot}>
      {gifs.map((ex, i) => (
        <Image
          key={ex.id}
          source={{ uri: exerciseGif(ex) }}
          resizeMode="cover"
          style={[
            styles.fanPhoto,
            {
              backgroundColor: "#fff",
              borderColor: colors.surface,
              left: i * 12,
              zIndex: gifs.length - i,
              transform: [{ rotate: `${(i - 1) * 6}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: 16 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { height: 34, width: 34, alignItems: "center", justifyContent: "center" },
  blurb: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  programCard: { marginTop: 12 },
  programTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  programText: { flex: 1, minWidth: 0 },
  programName: { fontSize: 18, letterSpacing: -0.3 },
  programSplit: { marginTop: 3, fontSize: 12.5 },
  daysBadge: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  daysNum: { fontSize: 18, lineHeight: 20 },
  daysUnit: { fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
  strip: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  stripPhoto: { height: 46, width: 52, borderRadius: 8, borderWidth: 1, backgroundColor: "#fff" },
  stripMore: {
    height: 46,
    width: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stripMoreText: { fontSize: 12 },
  programFootRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  programMeta: { flex: 1, minWidth: 0, fontSize: 12 },
  detail: { paddingHorizontal: 16, paddingTop: 12 },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailTitleText: { flex: 1, minWidth: 0 },
  detailName: { fontSize: 24, letterSpacing: -0.3 },
  detailBlurb: { marginTop: 12, fontSize: 13.5, lineHeight: 19 },
  routinesHead: { marginTop: 20 },
  routineList: { marginTop: 10, gap: 10 },
  routineRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  fanSlot: { width: 58, height: 44, justifyContent: "center" },
  fanPhoto: {
    position: "absolute",
    height: 40,
    width: 44,
    borderRadius: 8,
    borderWidth: 2,
  },
  routineRowText: { flex: 1, minWidth: 0 },
  routineName: { fontSize: 15 },
  routineExs: { marginTop: 2, fontSize: 11.5, lineHeight: 15, textTransform: "capitalize" },
  routinePlay: {
    height: 38,
    width: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: { marginTop: 22, alignItems: "center", gap: 8 },
  addPlate: { alignSelf: "stretch", borderRadius: 14, paddingVertical: 15 },
  addHintRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addHint: { fontSize: 11.5 },
});
