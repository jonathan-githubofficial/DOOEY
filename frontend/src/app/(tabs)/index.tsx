import { ScrollView, StyleSheet, View } from "react-native";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import { usePagePadding } from "@/lib/shell";
import { usePalette } from "@/stores/theme";

/** The front door: everything due today in one glance, arranged by you.
 * The widget stack lands here task by task — schedule, tasks, gym. */
export default function Home() {
  const colors = usePalette();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      {/* Pinned above the scroller: the space's name stays put while its
          contents run under it. */}
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="home" />} title="Home" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: page.paddingBottom }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  head: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  scrollContent: {
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
