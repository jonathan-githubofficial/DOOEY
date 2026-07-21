import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { hueColor, usePrograms, type Program } from "@/features/learning/api";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { useProjectTasks } from "@/features/tasks/api";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

/** Projects: learning programs as file-folder cards. Building a new program
 * happens on the web (learning-architect + push-program); here the folders
 * open into their work. */
export default function Projects() {
  const colors = usePalette();
  const type = useType();
  const insets = useSafeAreaInsets();
  const { data: programs, isPending } = usePrograms();

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
      >
        <Masthead avatar={<PageDoodle page="learning" />} title="Projects" />

        {programs?.length === 0 && !isPending && (
          <Panel style={styles.emptyPanel}>
            <Eyebrow>projects</Eyebrow>
            <Text style={[styles.emptyTitle, type.display, { color: colors.ink }]}>
              Nothing on the shelf yet.
            </Text>
            <Text style={[styles.emptyBody, type.sans, { color: colors.inkMuted }]}>
              Build a learning program on the web app — it lands here as a folder, and its
              sessions become ordinary tasks in your planner.
            </Text>
          </Panel>
        )}

        <View style={styles.folders}>
          {(programs ?? []).map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <FolderCard program={p} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** A program as a file folder: the tab up top, the goal on the label, progress
 * across the bottom. */
function FolderCard({ program }: { program: Program }) {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: tasks } = useProjectTasks(program.id);
  const total = tasks?.length ?? 0;
  const done = tasks?.filter((t) => t.done_at).length ?? 0;
  const accent = hueColor(program.hue, colors);

  return (
    <View style={styles.folderWrap}>
      {/* The folder tab. */}
      <View
        style={[
          styles.folderTab,
          { backgroundColor: alpha(accent, 0.25), borderColor: alpha(accent, 0.4) },
        ]}
      />
      <PressableScale scaleTo={0.98} onPress={() => router.push(`/project/${program.id}`)}>
        <Panel style={styles.folder}>
          <View style={[styles.folderStripe, { backgroundColor: alpha(accent, 0.5) }]} />
          <Text numberOfLines={2} style={[styles.folderGoal, type.display, { color: colors.ink }]}>
            {program.goal}
          </Text>
          {!!program.why && (
            <Text numberOfLines={2} style={[styles.folderWhy, type.sans, { color: colors.inkMuted }]}>
              {program.why}
            </Text>
          )}
          {total > 0 && (
            <View style={styles.progressRow}>
              <View style={[styles.progressTrack, { backgroundColor: alpha(colors.ink, 0.06) }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(done / total) * 100}%`, backgroundColor: colors.leaf },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, type.sans, { color: colors.inkMuted }]}>
                {done}/{total}
              </Text>
            </View>
          )}
        </Panel>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  emptyPanel: { marginTop: 24, padding: 28 },
  emptyTitle: { marginTop: 8, fontSize: 24, letterSpacing: -0.5 },
  emptyBody: { marginTop: 8, fontSize: 14, lineHeight: 21 },
  folders: { marginTop: 24, gap: 20 },
  folderWrap: {},
  folderTab: {
    marginLeft: 16,
    height: 14,
    width: 96,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  folder: { padding: 20, borderTopLeftRadius: 6 },
  folderStripe: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  folderGoal: { fontSize: 19, letterSpacing: -0.3, paddingLeft: 8 },
  folderWhy: { marginTop: 6, fontSize: 13, lineHeight: 19, paddingLeft: 8 },
  progressRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  progressText: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
