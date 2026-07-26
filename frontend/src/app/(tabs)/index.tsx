import type { ComponentType } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Check as CheckIcon, Pencil } from "lucide-react-native";
import { ArrangeList } from "@/components/ArrangeList";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { GymTodayWidget } from "@/features/home/components/GymTodayWidget";
import { ScheduleWidget } from "@/features/home/components/ScheduleWidget";
import { TasksTodayWidget } from "@/features/home/components/TasksTodayWidget";
import { HOME_WIDGETS, type WidgetKey } from "@/features/home/layout";
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
  gym: GymTodayWidget,
};

/** The front door: everything due today in one glance, arranged by you.
 * The widget stack lands here task by task — schedule, tasks, gym. */
export default function Home() {
  const colors = usePalette();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);
  const order = useHomeStore((s) => s.widgetOrder);
  const hidden = useHomeStore((s) => s.widgetHidden);
  const editing = useHomeStore((s) => s.editing);
  const setEditing = useHomeStore((s) => s.setEditing);
  const setWidgets = useHomeStore((s) => s.setWidgets);

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      {/* Pinned above the scroller: the space's name stays put while its
          contents run under it. */}
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="home" />} title="Home">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={editing ? "Done arranging" : "Arrange Home"}
            onPress={() => setEditing(!editing)}
          >
            {editing ? (
              <CheckIcon size={20} color={colors.zest} />
            ) : (
              <Pencil size={20} color={colors.inkMuted} />
            )}
          </PressableScale>
        </Masthead>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: page.paddingBottom }]}
      >
        {editing && (
          <Panel style={styles.arrange}>
            <Eyebrow>arrange</Eyebrow>
            <ArrangeList
              items={HOME_WIDGETS.map((w) => ({ key: w.key, label: w.label }))}
              order={order}
              hidden={hidden}
              onChange={(o, h) => setWidgets(o as WidgetKey[], h as WidgetKey[])}
            />
          </Panel>
        )}
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
  arrange: { gap: 12 },
});
