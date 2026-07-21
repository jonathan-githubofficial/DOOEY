import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Panel } from "@/components/surface";
import { AgendaSheet } from "@/features/tasks/components/AgendaSheet";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { TaskComposer } from "@/features/tasks/components/TaskComposer";
import { WeekStrip } from "@/features/tasks/components/WeekStrip";
import { localDate } from "@/lib/dates";
import { usePalette } from "@/stores/theme";

/** The planner: the date shelf up top, the ring-bound pad below, the new-task
 * stamp floating above the dock. Switching days flips the page over the
 * rings, desk-calendar style. */
export default function Planner() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);

  const select = (date: string) => {
    if (date === selected) return;
    setDirection(date > selected ? 1 : -1);
    setSelected(date);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <View style={styles.strip}>
        <Panel style={styles.stripPanel}>
          <WeekStrip selected={selected} onSelect={select} />
        </Panel>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 128 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <PlannerBook page={selected} direction={direction}>
          <AgendaSheet date={selected} />
        </PlannerBook>
      </ScrollView>

      <TaskComposer date={selected} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  strip: {
    paddingHorizontal: 16,
  },
  stripPanel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
});
