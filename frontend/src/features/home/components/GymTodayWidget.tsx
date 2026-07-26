import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StampButton } from "@/components/surface";
import {
  useLiveWorkout,
  useRoutines,
  useStartWorkout,
  useWorkoutPrograms,
  useWorkouts,
} from "@/features/workouts/api";
import { lastDoneAt, nextUp, sinceLabel } from "@/features/workouts/rotation";
import { usePalette, useType } from "@/stores/theme";
import { HomeWidget } from "./HomeWidget";

/** The routine on deck — the rotation's suggestion — one tap from logging
 * set one. While a session runs, this is the way back into it. */
export function GymTodayWidget() {
  const colors = usePalette();
  const type = useType();
  const router = useRouter();
  const { data: routines = [] } = useRoutines();
  const { data: programs = [] } = useWorkoutPrograms();
  const { data: workouts = [] } = useWorkouts();
  const live = useLiveWorkout();
  const start = useStartWorkout();

  const openWorkout = (id: string) =>
    router.push({ pathname: "/workout/[id]", params: { id } });

  if (live) {
    return (
      <HomeWidget title="gym">
        <View style={styles.row}>
          <View style={styles.text}>
            <Text style={[type.display, styles.name, { color: colors.ink }]}>{live.title}</Text>
            <Text style={[type.sans, styles.sub, { color: colors.inkMuted }]}>
              Session in progress
            </Text>
          </View>
          <StampButton onPress={() => openWorkout(live.id)}>Resume</StampButton>
        </View>
      </HomeWidget>
    );
  }

  const routine = nextUp(routines, programs, workouts);
  if (!routine) {
    return (
      <HomeWidget title="gym">
        <Pressable onPress={() => router.push("/gym")}>
          <Text style={[type.sans, styles.sub, { color: colors.inkMuted }]}>
            No routines yet — set up your program in Gym.
          </Text>
        </Pressable>
      </HomeWidget>
    );
  }

  const program = programs.find((p) => p.id === routine.program);
  const last = lastDoneAt(routine.id, workouts);
  const since = sinceLabel(last);

  return (
    <HomeWidget title="gym">
      <View style={styles.row}>
        <Pressable
          style={styles.text}
          onPress={() => router.push({ pathname: "/routine/[id]", params: { id: routine.id } })}
        >
          <Text style={[type.display, styles.name, { color: colors.ink }]}>{routine.name}</Text>
          <Text style={[type.sans, styles.sub, { color: colors.inkMuted }]}>
            {[program?.name, since].filter(Boolean).join(" · ")}
          </Text>
        </Pressable>
        <StampButton
          disabled={start.isPending}
          onPress={() => start.mutate(routine, { onSuccess: (w) => openWorkout(w.id) })}
        >
          Start
        </StampButton>
      </View>
    </HomeWidget>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 18 },
  sub: { fontSize: 13 },
});
