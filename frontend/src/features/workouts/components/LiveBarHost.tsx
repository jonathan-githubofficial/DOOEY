import { usePathname, useRouter } from "expo-router";
import { useDockTop } from "@/lib/shell";
import { useDeleteWorkout, useFinishWorkout, useLiveWorkout, useTogglePause } from "../api";
import { BAR_GAP } from "../live-bar";
import { LiveBar } from "./LiveBar";

/** The six spaces — the only routes that draw a dock for the bar to clear. */
const TAB_PATHS = new Set(["/", "/planner", "/boards", "/projects", "/gym", "/account"]);

/** Routes the bar keeps out of: the front door, and the compose sheet it would
 * otherwise float over. The live session's own page is excluded too — the bar
 * is a way back to it, so it has no business sitting on top of it. */
const HIDDEN = new Set(["/login", "/onboarding", "/compose"]);

/** Mounts the live workout bar over every route. Lives at the root, above the
 * navigator, so it survives moving between spaces and stays put when a detail
 * page pushes over the tabs. */
export function LiveBarHost() {
  const router = useRouter();
  const pathname = usePathname();
  const workout = useLiveWorkout();
  const dock = useDockTop(TAB_PATHS.has(pathname));
  const pause = useTogglePause();
  const finish = useFinishWorkout();
  const discard = useDeleteWorkout();

  if (!workout) return null;
  if (HIDDEN.has(pathname) || pathname === `/workout/${workout.id}`) return null;

  return (
    <LiveBar
      workout={workout}
      bottom={dock + BAR_GAP}
      onOpen={() => router.push(`/workout/${workout.id}`)}
      onPause={() => pause.mutate(workout)}
      onFinish={() => finish.mutate(workout)}
      onDiscard={() => discard.mutate(workout.id)}
    />
  );
}
