import type { ComponentType } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { ScheduleWidget } from "@/features/home/components/ScheduleWidget";
import { TasksTodayWidget } from "@/features/home/components/TasksTodayWidget";
import type { WidgetKey } from "@/features/home/layout";
import { useHomeStore } from "@/features/home/store";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { TaskComposer } from "@/features/tasks/components/TaskComposer";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import { localDate } from "@/lib/dates";
import { usePagePadding } from "@/lib/shell";
import { usePalette } from "@/stores/theme";

/** Widgets register here as they land; a key the registry doesn't know yet
 * simply doesn't render, so the persisted order can run ahead of the code. */
const WIDGET_VIEWS: Partial<Record<WidgetKey, ComponentType>> = {
  schedule: ScheduleWidget,
  tasks: TasksTodayWidget,
};

/** The front door: everything due today in one glance, arranged by you.
 * The widget stack lands here task by task — schedule, tasks, gym. */
export default function Home() {
  const colors = usePalette();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);
  const order = useHomeStore((s) => s.widgetOrder);
  const hidden = useHomeStore((s) => s.widgetHidden);

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
      >
        {order
          .filter((key) => !hidden.includes(key))
          .map((key) => {
            const Widget = WIDGET_VIEWS[key];
            return Widget ? <Widget key={key} /> : null;
          })}
      </ScrollView>
      <TaskComposer date={localDate()} />
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
