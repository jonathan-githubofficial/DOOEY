import { ChevronLeft, ChevronRight, FolderPlus, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useCardInk, type CardInk } from "../hues";
import { exerciseGif, libraryExercise } from "../library";
import { PROGRAMS, type Program, type ProgramRoutine } from "../programs";
import { CARD_HUES, type CardHue } from "../types";
import { CardShell } from "./card-parts";

/** Explore programs: browse the famous splits, open one to see its routines,
 * then start a routine (→ the log page) or add the whole program to your gym. */
export function ProgramsExplorer({
  visible,
  onStartRoutine,
  onSaveRoutine,
  onAddProgram,
  onNewProgram,
  onClose,
}: {
  visible: boolean;
  onStartRoutine: (routine: ProgramRoutine) => void;
  onSaveRoutine: (program: Program, routine: ProgramRoutine) => void;
  onAddProgram: (program: Program) => void;
  /** None of the shelf fits: name an empty program of your own instead. */
  onNewProgram: () => void;
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
          <Eyebrow style={styles.headLabel}>programs</Eyebrow>
          {/* Nothing on the shelf fits? Build the folder yourself, from the
              same corner you came looking in. */}
          <PressableScale
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityLabel="New program"
            onPress={() => {
              hapticTap();
              onNewProgram();
            }}
            style={[
              styles.newBtn,
              { borderColor: alpha(colors.zest, 0.5), backgroundColor: alpha(colors.zest, 0.12) },
            ]}
          >
            <FolderPlus size={15} color={colors.zest} />
            <Text style={[styles.newLabel, type.sansMedium, { color: colors.zest }]}>
              New program
            </Text>
          </PressableScale>
          <PressableScale scaleTo={0.85} accessibilityLabel="Close" onPress={close} style={styles.close}>
            <X size={18} color={colors.inkMuted} />
          </PressableScale>
        </View>
        <Text style={[styles.blurb, type.sans, { color: colors.inkMuted }]}>
          Proven splits. Tap one to preview a day, then start it or save it.
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: insets.bottom + 24, gap: 12 }}
        >
          {PROGRAMS.map((p, idx) => (
            <ProgramRow
              key={p.key}
              program={p}
              hue={CARD_HUES[idx % CARD_HUES.length]}
              onPress={() => {
                hapticTap();
                setOpen(p);
              }}
            />
          ))}
        </ScrollView>

        {open && (
          <ProgramDetail
            program={open}
            onStartRoutine={(r) => {
              onStartRoutine(r);
              close();
            }}
            onSaveRoutine={(r) => {
              onSaveRoutine(open, r);
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

/** A program on the shelf, in the same colour-field card the gym wall uses —
 * browsing a split and owning one should look like the same kind of object. */
function ProgramRow({
  program,
  hue,
  onPress,
}: {
  program: Program;
  hue: CardHue;
  onPress: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk()(hue);

  return (
    <CardShell
      hue={hue}
      // No emblem: a drawing marks a routine as yours, and a catalogue split
      // isn't yet. The colour field and the stamp carry it.
      emblem={[]}
      lean="0deg"
      accessibilityLabel={program.name}
      onPress={onPress}
    >
      <View style={styles.programTopRow}>
        <View style={styles.programText}>
          <Text style={[styles.programName, type.display, { color: colors.ink }]}>
            {program.name}
          </Text>
          <Text style={[styles.programSplit, type.sansMedium, { color: ink.stamp }]}>
            {program.split}
          </Text>
        </View>
        <Stamp color={ink.stamp} rotate={-3}>
          {program.days.split(/[\s–-]/)[0]} days
        </Stamp>
      </View>
      <ProgramThumbs program={program} ink={ink} />

      <View style={styles.programFootRow}>
        <Text numberOfLines={1} style={[styles.programMeta, type.sans, { color: colors.inkMuted }]}>
          {program.routines.length} routines · {program.bestFor}
        </Text>
        <ChevronRight size={16} color={colors.inkMuted} />
      </View>
    </CardShell>
  );
}

/** The split's exercises as paper tokens on the colour field — round, backed
 * by surface, overlapping like a handful of coins. A demo still on a white
 * rectangle would punch a hole in the card. */
function ProgramThumbs({ program, ink }: { program: Program; ink: CardInk }) {
  const colors = usePalette();
  const type = useType();

  const seen = new Set<string>();
  const gifs: string[] = [];
  for (const r of program.routines) {
    for (const it of r.items) {
      if (!it.libId || seen.has(it.libId)) continue;
      seen.add(it.libId);
      const ex = libraryExercise(it.libId);
      if (ex && gifs.length < 4) gifs.push(exerciseGif(ex, 180));
    }
  }
  const rest = seen.size - gifs.length;
  if (gifs.length === 0) return null;

  const token = { backgroundColor: alpha(colors.surface, 0.9), borderColor: ink.field };
  return (
    <View style={styles.thumbRow}>
      {gifs.map((uri, i) => (
        <View key={uri} style={[styles.thumb, token, i > 0 && styles.thumbLap]}>
          <Image source={{ uri }} resizeMode="cover" style={styles.thumbImg} />
        </View>
      ))}
      {rest > 0 && (
        <View style={[styles.thumb, styles.thumbLap, styles.thumbMore, token]}>
          <Text style={[styles.thumbMoreText, type.sansMedium, { color: ink.stamp }]}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

function ProgramDetail({
  program,
  onStartRoutine,
  onSaveRoutine,
  onAdd,
  onBack,
}: {
  program: Program;
  onStartRoutine: (r: ProgramRoutine) => void;
  onSaveRoutine: (r: ProgramRoutine) => void;
  onAdd: () => void;
  onBack: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<ProgramRoutine | null>(null);
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
              accessibilityLabel={`Preview ${r.name}`}
              onPress={() => {
                hapticTap();
                setPreview(r);
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
                <ChevronRight size={18} color={colors.inkMuted} />
              </Panel>
            </Pressable>
          ))}
        </View>

        <View style={styles.addRow}>
          <Plate label="Add program to my gym" onPress={onAdd} style={styles.addPlate} />
        </View>
      </ScrollView>

      {preview && (
        <RoutinePreview
          program={program}
          routine={preview}
          onStart={() => onStartRoutine(preview)}
          onSave={() => onSaveRoutine(preview)}
          onBack={() => setPreview(null)}
        />
      )}
    </Animated.View>
  );
}

/** A routine preview: its exercises with their targets, and the two ways out —
 * start it now, or save it to your own routines. */
function RoutinePreview({
  program,
  routine,
  onStart,
  onSave,
  onBack,
}: {
  program: Program;
  routine: ProgramRoutine;
  onStart: () => void;
  onSave: () => void;
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
          <PressableScale scaleTo={0.85} accessibilityLabel="Back" onPress={onBack} style={styles.close}>
            <ChevronLeft size={20} color={colors.inkMuted} />
          </PressableScale>
          <View style={styles.detailTitleText}>
            <Text style={[styles.detailName, fontStyle("fraunces", "900"), { color: colors.ink }]}>
              {routine.name}
            </Text>
            <Text style={[styles.programMeta, type.sans, { color: colors.inkMuted }]}>
              {program.name} · {routine.items.length} exercises
            </Text>
          </View>
        </View>

        <View style={styles.previewList}>
          {routine.items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.previewRow}>
              <PreviewThumb libId={it.libId} />
              <Text numberOfLines={1} style={[styles.previewName, type.sansMedium, { color: colors.ink }]}>
                {it.name}
              </Text>
              <Text style={[styles.previewSets, type.sansSemiBold, { color: colors.zest }]}>
                {it.sets} × {it.target_reps}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.previewActions}>
          <Plate label="Start workout" onPress={onStart} style={styles.addPlate} />
          <PressableScale
            scaleTo={0.98}
            accessibilityLabel="Save to my routines"
            onPress={onSave}
            style={[styles.saveBtn, { borderColor: alpha(colors.ink, 0.18) }]}
          >
            <Plus size={14} color={colors.ink} />
            <Text style={[styles.saveText, type.sansMedium, { color: colors.ink }]}>Save to my routines</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

function PreviewThumb({ libId }: { libId?: string }) {
  const colors = usePalette();
  const ex = libraryExercise(libId);
  if (!ex) return <View style={[styles.previewThumb, { borderColor: alpha(colors.rule, 0.7) }]} />;
  return (
    <Image
      source={{ uri: exerciseGif(ex, 180) }}
      resizeMode="cover"
      style={[styles.previewThumb, { borderColor: alpha(colors.rule, 0.7), backgroundColor: "#fff" }]}
    />
  );
}

/** A strip of the program's exercise demos — a visual taste of what's inside. */
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
          source={{ uri: exerciseGif(ex, 180) }}
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
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headLabel: { flex: 1 },
  newBtn: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  newLabel: { fontSize: 12 },
  close: { height: 34, width: 34, alignItems: "center", justifyContent: "center" },
  blurb: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  programTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  programText: { flex: 1, minWidth: 0 },
  programName: { fontSize: 18, letterSpacing: -0.3 },
  programSplit: { marginTop: 3, fontSize: 12.5 },
  thumbRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  thumb: {
    height: 40,
    width: 40,
    borderRadius: 999,
    borderWidth: 2,
    overflow: "hidden",
  },
  thumbLap: { marginLeft: -9 },
  thumbImg: { height: "100%", width: "100%" },
  thumbMore: { alignItems: "center", justifyContent: "center" },
  thumbMoreText: { fontSize: 12 },
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
  addRow: { marginTop: 22 },
  addPlate: { alignSelf: "stretch", borderRadius: 14, paddingVertical: 15 },
  previewList: { marginTop: 16, gap: 10 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  previewThumb: { height: 40, width: 48, borderRadius: 8, borderWidth: 1 },
  previewName: { flex: 1, minWidth: 0, fontSize: 14, textTransform: "capitalize" },
  previewSets: { fontSize: 13, fontVariant: ["tabular-nums"] },
  previewActions: { marginTop: 22, gap: 10 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
  saveText: { fontSize: 13.5 },
});
