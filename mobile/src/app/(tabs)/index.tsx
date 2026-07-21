import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Grain } from "@/components/grain";
import { Panel } from "@/components/surface";
import { usePrefetchAdjacentDays } from "@/features/tasks/api";
import { AgendaSheet } from "@/features/tasks/components/AgendaSheet";
import { MonthView } from "@/features/tasks/components/MonthView";
import { PlannerBook } from "@/features/tasks/components/PlannerBook";
import { TaskComposer } from "@/features/tasks/components/TaskComposer";
import { WeekStrip } from "@/features/tasks/components/WeekStrip";
import { localDate } from "@/lib/dates";
import { usePalette } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(380).damping(34);

/** The planner: the date shelf up top (a week strip that unfolds into the
 * whole month, like the web), the ring-bound pad below, the new-task stamp
 * floating above the tab bar. Switching days flips the page over the rings,
 * desk-calendar style. */
export default function Planner() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(localDate);
  const [direction, setDirection] = useState(1);
  const [shelf, setShelf] = useState<"week" | "month">("week");
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  usePrefetchAdjacentDays(selected);

  const select = (date: string) => {
    if (date === selected) return;
    setDirection(date > selected ? 1 : -1);
    setSelected(date);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 20 }]}>
      <Grain />
      <Animated.View layout={settle} style={styles.strip}>
        <Panel style={styles.stripPanel}>
          <Animated.View key={shelf} entering={FadeIn.duration(180)}>
            {shelf === "week" ? (
              <WeekStrip
                selected={selected}
                onSelect={select}
                onToggleView={() => {
                  setMonth(selected.slice(0, 7));
                  setShelf("month");
                }}
              />
            ) : (
              <MonthView
                month={month}
                onMonth={setMonth}
                selected={selected}
                onSelect={(d) => {
                  select(d);
                  setShelf("week");
                }}
                onToggleView={() => setShelf("week")}
              />
            )}
          </Animated.View>
        </Panel>
      </Animated.View>

      {/* The pad glides down as the shelf unfolds — same settle as the shelf. */}
      <Animated.View layout={settle} style={styles.scroll}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(16, insets.bottom) + 128 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <PlannerBook
            page={selected}
            direction={direction}
            renderPage={(d) => <AgendaSheet date={d} />}
          />
        </ScrollView>
      </Animated.View>

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
    paddingVertical: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
});
