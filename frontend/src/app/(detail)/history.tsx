import { useRouter } from "expo-router";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { prSessions, useDeleteWorkout, useWorkouts } from "@/features/workouts/api";
import { HISTORY_STATS_H, cardHeight } from "@/features/workouts/card-metrics";
import { DayCell, LETTERS } from "@/features/workouts/components/DayCell";
import { HistoryCard } from "@/features/workouts/components/HistoryCard";
import { Masonry } from "@/features/workouts/components/Masonry";
import { journeyWeeks } from "@/features/workouts/rotation";
import type { Workout } from "@/features/workouts/types";
import { confirmDestructive } from "@/lib/confirm";
import { dur, ease } from "@/lib/motion";
import { usePagePadding } from "@/lib/shell";
import { fontStyle } from "@/features/style/tokens";
import type { Menu } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";

/** Rows fade in from the current week outwards, and the stagger stops after
 * this many — nobody watches the top of a six-month grid arrive. */
const MAX_STAGGER = 8;

/** Every week you have trained, and every session in them.
 *
 * This used to be a second state of the gym's week card, opened out in place.
 * But "how is this week going" and "what have I done since January" are
 * different questions, and the second is not a state of the first — a card that
 * answered both had to be two cards' worth of layout wearing one, and the
 * ticket's stub got pushed off the bottom whenever it grew. So it is a page.
 *
 * The grid is the point of it. A list of session cards can tell you what you
 * did; only the grid shows you that you have skipped legs three weeks running,
 * because the shape of the gaps *is* the information. */
export default function History() {
  const colors = usePalette();
  const type = useType();
  const page = usePagePadding();
  const router = useRouter();
  const { data: workouts } = useWorkouts();
  const delWorkout = useDeleteWorkout();

  const journey = useMemo(() => journeyWeeks(workouts ?? []), [workouts]);
  const sessions = useMemo(() => (workouts ?? []).filter((w) => w.ended_at), [workouts]);
  const prs = useMemo(() => prSessions(workouts ?? []), [workouts]);

  const weeks = journey.weeks;
  const thisWeek = weeks[weeks.length - 1];
  const earlier = weeks.slice(0, -1);

  const since = journey.clipped
    ? "Your last six months"
    : journey.first
      ? `Since ${journey.first.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
      : "Nothing logged yet — the first one fills a square";

  const openWorkout = (id: string) => router.push({ pathname: "/workout/[id]", params: { id } });

  const sessionMenu = (workout: Workout): Menu => ({
    title: workout.title,
    actions: [
      {
        label: "Delete session",
        symbol: "trash",
        destructive: true,
        icon: <Trash2 size={17} color={colors.clay} />,
        onPress: () =>
          confirmDestructive(
            "Delete this session?",
            "The workout and everything logged in it go for good.",
            "Delete session",
            () => delWorkout.mutate(workout.id),
          ),
      },
    ],
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      <View style={styles.head}>
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.inkMuted} />
        </PressableScale>
        <Masthead title="History" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: page.paddingBottom }]}
      >
        <Panel style={styles.journey}>
          <Text
            numberOfLines={1}
            style={[fontStyle("fraunces", "900"), styles.count, { color: colors.ink }]}
          >
            {journey.sessions}
            <Text style={[type.sans, styles.countUnit, { color: colors.inkMuted }]}>
              {journey.sessions === 1 ? " session logged" : " sessions logged"}
            </Text>
          </Text>

          <View style={styles.grid}>
            {earlier.map((week, wi) => (
              <Animated.View
                key={week[0].date.toISOString()}
                // Nearest weeks first: the grid grows away from the row you
                // were already looking at, rather than raining down onto it.
                entering={FadeIn.duration(dur.quick)
                  .easing(ease.out)
                  .delay(Math.min(earlier.length - 1 - wi, MAX_STAGGER) * 22)}
                style={styles.row}
              >
                {week.map((day) => (
                  <DayCell key={day.date.toISOString()} day={day} compact onOpen={openWorkout} />
                ))}
              </Animated.View>
            ))}

            {/* This week keeps the full-size keys it wears on the gym page, so
                the row you arrived from stays the "you are here" of the grid
                rather than dissolving into it. */}
            <View style={[styles.row, styles.thisWeekRow]}>
              {thisWeek.map((day, i) => (
                <DayCell
                  key={day.date.toISOString()}
                  day={day}
                  letter={LETTERS[i]}
                  onOpen={openWorkout}
                />
              ))}
            </View>
          </View>

          <Text numberOfLines={1} style={[type.sans, styles.footText, { color: colors.inkMuted }]}>
            {since}
          </Text>
        </Panel>

        {sessions.length === 0 ? (
          <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
            No workouts yet. Start one from the ticket on the Gym page.
          </Text>
        ) : (
          <View style={styles.wall}>
            <Masonry
              items={sessions}
              estimateHeight={(w) => cardHeight(w.entries.length, HISTORY_STATS_H)}
              renderItem={(w, i) => (
                <Animated.View
                  key={w.id}
                  entering={FadeInDown.delay(Math.min(i, MAX_STAGGER) * 40).duration(220)}
                >
                  <HistoryCard
                    workout={w}
                    index={i}
                    isPR={prs.has(w.id)}
                    onPress={() => openWorkout(w.id)}
                    menu={() => sessionMenu(w)}
                  />
                </Animated.View>
              )}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 2 },
  back: { height: 40, width: 36, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 10 },

  journey: { padding: 16 },
  count: { fontSize: 23, letterSpacing: -0.7 },
  countUnit: { fontSize: 12.5, letterSpacing: 0 },
  // The column gap is the same in every row or the columns don't line up —
  // it's one grid, not a strip with a chart above it.
  grid: { marginTop: 11, gap: 4 },
  row: { flexDirection: "row", gap: 6 },
  // A hair of air above this week, so the bold row reads as the base of the
  // grid rather than one more entry in it.
  thisWeekRow: { marginTop: 4 },
  footText: { fontSize: 11.5, marginTop: 11 },

  wall: { marginTop: 22 },
  empty: { fontSize: 12.5, textAlign: "center", paddingVertical: 20 },
});
