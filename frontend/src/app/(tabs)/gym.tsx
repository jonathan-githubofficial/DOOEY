import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  BookOpen,
  Dumbbell,
  Palette,
  Plus,
  Trash2,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { usePagePadding } from "@/lib/shell";
import { DotsButton } from "@/components/dots-button";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { Plate } from "@/components/plate";
import { PressableScale } from "@/components/pressable-scale";
import { Panel } from "@/components/surface";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { useCardRadius } from "@/features/style/store";
import {
  prSessions,
  useAddProgram,
  useDeleteProgram,
  useDeleteRoutine,
  useDeleteWorkout,
  useWorkoutPrograms,
  useRoutines,
  useSaveLooseRoutine,
  useSaveProgram,
  useSaveRoutine,
  useStartWorkout,
  useWorkouts,
} from "@/features/workouts/api";
import { HISTORY_STATS_H, TWIN_H, cardHeight } from "@/features/workouts/card-metrics";
import { CardDesigner } from "@/features/workouts/components/CardDesigner";
import { HistoryCard } from "@/features/workouts/components/HistoryCard";
import { Masonry } from "@/features/workouts/components/Masonry";
import { ProgramsExplorer } from "@/features/workouts/components/ProgramsExplorer";
import { RoutineCard } from "@/features/workouts/components/RoutineCard";
import { UpNextCard } from "@/features/workouts/components/UpNextCard";
import { WeekPanel } from "@/features/workouts/components/WeekPanel";
import type { CatalogProgram, ProgramRoutine } from "@/features/workouts/programs";
import {
  journeyWeeks,
  lastDoneAt,
  nextUp,
  restedLongest,
  weekTargets,
} from "@/features/workouts/rotation";
import { STARTER_PROGRAM } from "@/features/workouts/starters";
import { NewProgramDeck } from "@/features/workouts/components/NewProgramDeck";
import { useWorkoutPrefs } from "@/features/workouts/store";
import {
  type Routine,
  type RoutineTemplate,
  type Workout,
  type WorkoutProgram,
} from "@/features/workouts/types";
import { confirmDestructive } from "@/lib/confirm";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import type { Menu } from "@/stores/sheet";
import { usePalette, useType } from "@/stores/theme";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import { settle } from "@/lib/motion";

const ADD_TILE_H = 96;
/** Late cards shouldn't wait out a stagger nobody's watching. */
const MAX_STAGGER = 8;

/** What the page is showing below the week panel: the routines you'd train, or
 * the sessions you did. Opening the panel out is what moves between them. */
type Tab = "workout" | "history";

/** A routine card or the tile that makes another one — both ride the masonry. */
type CardItem = { kind: "routine"; routine: Routine } | { kind: "add" };

/** The gym: what to train today up top, then your routines as a board. History
 * swaps the board for finished sessions. The running session rides above both. */
export default function Gym() {
  const colors = usePalette();
  const type = useType();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);
  const router = useRouter();
  const { data: programs } = useWorkoutPrograms();
  const { data: routines } = useRoutines();
  const { data: workouts } = useWorkouts();
  const saveProgram = useSaveProgram();
  const delProgram = useDeleteProgram();
  const saveRoutine = useSaveRoutine();
  const delRoutine = useDeleteRoutine();
  const addProgram = useAddProgram();
  const saveLoose = useSaveLooseRoutine();
  const delWorkout = useDeleteWorkout();
  const start = useStartWorkout();
  const seededFlag = useWorkoutPrefs((s) => s.seededRoutines);
  const markSeeded = useWorkoutPrefs((s) => s.markSeeded);
  const defaultRest = useWorkoutPrefs((s) => s.restSeconds);
  const [tab, setTab] = useState<Tab>("workout");
  const [exploring, setExploring] = useState(false);
  const [creating, setCreating] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [designing, setDesigning] = useState<Routine | null>(null);

  const live = workouts?.find((w) => !w.ended_at) ?? null;
  const history = useMemo(() => (workouts ?? []).filter((w) => w.ended_at), [workouts]);
  const prs = useMemo(() => prSessions(workouts ?? []), [workouts]);
  const upNext = useMemo(
    () => nextUp(routines ?? [], programs ?? [], workouts ?? []),
    [routines, programs, workouts],
  );
  const journey = useMemo(() => journeyWeeks(workouts ?? []), [workouts]);
  const painted = useMemo(() => weekTargets(workouts ?? []), [workouts]);
  const rested = useMemo(() => restedLongest(workouts ?? []), [workouts]);
  const programsReady = !!programs;

  // Routines grouped by the program they belong to.
  const byProgram = new Map<string, Routine[]>();
  for (const r of routines ?? []) {
    const arr = byProgram.get(r.program);
    if (arr) arr.push(r);
    else byProgram.set(r.program, [r]);
  }

  // First open with an empty, never-seeded gym → plant the PPL starter program.
  useEffect(() => {
    if (programsReady && programs.length === 0 && !seededFlag && !addProgram.isPending) {
      markSeeded();
      addProgram.mutate(STARTER_PROGRAM);
    }
  }, [programsReady, programs, seededFlag, addProgram, markSeeded]);

  const openWorkout = (wid: string) =>
    router.push({ pathname: "/workout/[id]", params: { id: wid } });
  const openRoutine = (rid: string) =>
    router.push({ pathname: "/routine/[id]", params: { id: rid } });

  const startWorkout = (routine: RoutineTemplate | null) => {
    if (live) return openWorkout(live.id); // one session at a time
    start.mutate(routine, { onSuccess: (w) => openWorkout(w.id) });
  };

  const toggleCollapsed = (id: string) => {
    hapticTap();
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const newProgram = () => setCreating(true);

  const addRoutine = (program: WorkoutProgram) =>
    saveRoutine.mutate(
      { name: "New routine", items: [], program: program.id },
      { onSuccess: (r) => openRoutine(r.id) },
    );

  const programMenu = (program: WorkoutProgram): Menu => ({
    title: program.name,
    actions: [
      {
        label: "Delete program",
        symbol: "trash",
        destructive: true,
        icon: <Trash2 size={17} color={colors.clay} />,
        onPress: () =>
          confirmDestructive(
            `Delete “${program.name}”?`,
            "Removes the program and its routines. Logged sessions stay in your history.",
            "Delete program",
            () => delProgram.mutate(program.id),
          ),
      },
    ],
  });

  const routineMenu = (routine: Routine): Menu => ({
    title: routine.name,
    actions: [
      {
        label: "Design card",
        symbol: "paintpalette",
        icon: <Palette size={17} color={colors.ink} />,
        onPress: () => setDesigning(routine),
      },
      {
        label: "Duplicate",
        symbol: "doc.on.doc",
        icon: <Copy size={17} color={colors.ink} />,
        onPress: () =>
          saveRoutine.mutate({
            name: `${routine.name} copy`,
            description: routine.description,
            items: routine.items,
            program: routine.program,
            hue: routine.hue,
            emblem: routine.emblem,
          }),
      },
      {
        label: "Delete routine",
        symbol: "trash",
        destructive: true,
        icon: <Trash2 size={17} color={colors.clay} />,
        onPress: () =>
          confirmDestructive(
            `Delete “${routine.name}”?`,
            "This removes the routine. Logged sessions stay in your history.",
            "Delete routine",
            () => delRoutine.mutate(routine.id),
          ),
      },
    ],
  });

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

  const addWholeProgram = (program: CatalogProgram) =>
    addProgram.mutate({
      name: program.name,
      description: program.split,
      routines: program.routines.map((r) => ({
        name: r.name,
        description: `${program.name} · ${r.name}`,
        items: r.items,
      })),
    });

  const hero = () => {
    if (!programsReady || !routines) return <HeroPlaceholder />;
    if (upNext) {
      return (
        <UpNextCard
          routine={upNext}
          programName={programs.find((p) => p.id === upNext.program)?.name ?? "Your gym"}
          lastDone={lastDoneAt(upNext.id, workouts ?? [])}
          onStart={() => startWorkout({ id: upNext.id, name: upNext.name, items: upNext.items })}
          onOpen={() => openRoutine(upNext.id)}
        />
      );
    }
    if (programs.length === 0) return <HeroPlaceholder />; // the starter program is landing
    return <HeroEmpty onCreate={() => addRoutine(programs[0])} />;
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      {/* Pinned above the scroller: the space's name and its Workout/History
          keys stay put while the page runs under them. */}
      {/* Just the space's name. The switch between what's ahead and what's
          behind lives in the week panel, which is already a calendar of both. */}
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="gym" />} title="Gym" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: page.paddingBottom },
        ]}
      >
        {/* The week is context, not an action — it belongs on screen even
            mid-session, and in both modes, because opening it out *is* the
            switch. Only "up next" steps aside, since you're already training
            the thing it would offer. */}
        <View style={styles.weekWrap}>
          <WeekPanel
            journey={journey}
            painted={painted}
            rested={rested}
            open={tab === "history"}
            onToggle={() => setTab(tab === "history" ? "workout" : "history")}
            onOpenSession={openWorkout}
          />
        </View>

        {tab === "workout" ? (
          <>
            {!live && <View style={styles.heroWrap}>{hero()}</View>}

            {(programs ?? []).map((p) => (
              <Animated.View key={p.id} layout={settle}>
                <ProgramSection
                  program={p}
                  routines={byProgram.get(p.id) ?? []}
                  collapsed={collapsed.has(p.id)}
                  onToggleCollapse={() => toggleCollapsed(p.id)}
                  onOpenRoutine={openRoutine}
                  onRename={(name) => saveProgram.mutate({ id: p.id, name })}
                  routineMenu={routineMenu}
                  programMenu={() => programMenu(p)}
                  onAddRoutine={() => addRoutine(p)}
                />
              </Animated.View>
            ))}

            {/* The shelf of proven splits, and where a program of your own
                starts too. It used to sit in the week panel's top corner, on
                screen every visit — but once you're following something, the
                last thing you need offered is somebody else's plan. It waits
                at the end of your own programs, where you'd go looking for it
                only when you'd run out of them. */}
            <PressableScale
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel="Browse programs"
              onPress={() => {
                hapticTap();
                setExploring(true);
              }}
              style={[
                styles.browse,
                { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
              ]}
            >
              <BookOpen size={15} color={colors.inkMuted} />
              <Text style={[styles.browseText, type.sansMedium, { color: colors.ink }]}>
                Browse programs
              </Text>
            </PressableScale>
          </>
        ) : (
          <View style={styles.historyWrap}>
            {history.length === 0 ? (
              <Text style={[styles.empty, type.sans, { color: colors.inkMuted }]}>
                No workouts yet — start one from the card up top.
              </Text>
            ) : (
              <Masonry
                items={history}
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
            )}
          </View>
        )}
      </ScrollView>

      <ProgramsExplorer
        visible={exploring}
        onStartRoutine={(r: ProgramRoutine) => {
          setExploring(false);
          startWorkout({ name: r.name, items: r.items });
        }}
        onSaveRoutine={(program, r) =>
          saveLoose.mutate({ name: r.name, description: `${program.name} · ${r.name}`, items: r.items })
        }
        onAddProgram={addWholeProgram}
        // The shelf steps aside first: two native modals can't share the
        // screen, so the naming prompt waits for it to finish sliding away.
        onNewProgram={() => {
          setExploring(false);
          setTimeout(newProgram, 250);
        }}
        onClose={() => setExploring(false)}
      />

      <NewProgramDeck
        visible={creating}
        defaultRest={defaultRest}
        onCreate={({ name, routines }) => {
          setCreating(false);
          addProgram.mutate({
            name,
            description: "",
            routines: routines.map((r) => ({ ...r, description: "" })),
          });
        }}
        onClose={() => setCreating(false)}
      />

      {designing && <CardDesigner routine={designing} onClose={() => setDesigning(null)} />}
    </View>
  );
}

/** The hero's shape while the gym is still loading (or the starter program is
 * landing) — so the page doesn't jump when it arrives. */
function HeroPlaceholder() {
  const colors = usePalette();
  const type = useType();
  return (
    <Panel style={styles.heroStub}>
      <Text style={[styles.stubText, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
        Setting up your gym…
      </Text>
    </Panel>
  );
}

/** Programs exist but nothing to train yet. */
function HeroEmpty({ onCreate }: { onCreate: () => void }) {
  const colors = usePalette();
  const type = useType();
  return (
    <Panel style={styles.heroStub}>
      <Dumbbell size={26} color={alpha(colors.inkMuted, 0.6)} />
      <Text style={[styles.emptyTitle, type.display, { color: colors.ink }]}>
        Build your first routine
      </Text>
      <Text style={[styles.emptyBody, type.sans, { color: colors.inkMuted }]}>
        Add a few exercises and it’ll show up here, ready to start.
      </Text>
      <Plate label="New routine" onPress={onCreate} style={styles.emptyPlate} />
    </Panel>
  );
}

/** One program: a quiet tracked rule you can fold, then its routines as a
 * two-column board. The rule stays Eyebrow-scale so program names never
 * outshout the routines under them. */
/** The section title, editable in place. It commits on blur rather than on a
 * button: there is nothing to confirm about a name, and a save button here
 * would be the modal we just removed, wearing a smaller hat. */
function ProgramTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const colors = usePalette();
  const type = useType();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = (draft ?? "").trim();
    if (draft !== null && next && next !== name) onRename(next);
    setDraft(null);
  };

  return (
    <TextInput
      value={draft ?? name}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      returnKeyType="done"
      selectTextOnFocus
      accessibilityLabel={`Rename ${name}`}
      style={[styles.programName, type.sansMedium, { color: colors.inkMuted }]}
    />
  );
}

function ProgramSection({
  program,
  routines,
  collapsed,
  onToggleCollapse,
  onOpenRoutine,
  onRename,
  routineMenu,
  programMenu,
  onAddRoutine,
}: {
  program: WorkoutProgram;
  routines: Routine[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenRoutine: (id: string) => void;
  onRename: (name: string) => void;
  routineMenu: (routine: Routine) => Menu;
  programMenu: () => Menu;
  onAddRoutine: () => void;
}) {
  const colors = usePalette();
  const type = useType();

  const items: CardItem[] = [
    ...routines.map((routine) => ({ kind: "routine" as const, routine })),
    { kind: "add" as const },
  ];

  return (
    <View style={styles.program}>
      <View style={styles.programHead}>
        {/* The chevron owns collapsing. The name is the name — tapping it puts
            a cursor in it, which is what tapping a title should always mean. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={collapsed ? `Expand ${program.name}` : `Collapse ${program.name}`}
          accessibilityState={{ expanded: !collapsed }}
          hitSlop={8}
          onPress={onToggleCollapse}
        >
          {collapsed ? (
            <ChevronRight size={13} color={colors.inkMuted} />
          ) : (
            <ChevronDown size={13} color={colors.inkMuted} />
          )}
        </Pressable>
        <ProgramTitle name={program.name} onRename={onRename} />
        <Text style={[styles.programCount, type.sansMedium, { color: alpha(colors.inkMuted, 0.8) }]}>
          {routines.length}
        </Text>
        <DotsButton label={`${program.name} options`} menu={programMenu} />
      </View>
      <View style={[styles.programRule, { backgroundColor: alpha(colors.rule, 0.5) }]} />

      {!collapsed && (
        <View style={styles.board}>
          <Masonry
            items={items}
            estimateHeight={(item) =>
              item.kind === "add" ? ADD_TILE_H : cardHeight(item.routine.items.length, TWIN_H)
            }
            renderItem={(item, i) =>
              item.kind === "add" ? (
                <AddRoutineTile key="add" label={program.name} onPress={onAddRoutine} />
              ) : (
                <Animated.View
                  key={item.routine.id}
                  entering={FadeInDown.delay(Math.min(i, MAX_STAGGER) * 40).duration(220)}
                >
                  <RoutineCard
                    routine={item.routine}
                    index={i}
                    onOpen={() => onOpenRoutine(item.routine.id)}
                    menu={() => routineMenu(item.routine)}
                  />
                </Animated.View>
              )
            }
          />
        </View>
      )}
    </View>
  );
}

function AddRoutineTile({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = usePalette();
  const type = useType();
  const radius = useCardRadius();
  return (
    <PressableScale
      scaleTo={0.96}
      accessibilityLabel={`Add a routine to ${label}`}
      onPress={onPress}
      style={[styles.addTile, { borderColor: alpha(colors.rule, 0.9), borderRadius: radius }]}
    >
      <View style={[styles.addRing, { borderColor: alpha(colors.inkMuted, 0.4) }]}>
        <Plus size={15} color={colors.inkMuted} />
      </View>
      <Text style={[styles.addText, type.sansMedium, { color: colors.inkMuted }]}>Add routine</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8 },
  scrollContent: { paddingHorizontal: 16 },


  weekWrap: { marginTop: 22 },
  heroWrap: { marginTop: 14 },
  heroStub: { minHeight: 220, alignItems: "center", justifyContent: "center", padding: 28 },
  stubText: { fontSize: 13 },
  emptyTitle: { marginTop: 10, fontSize: 21, letterSpacing: -0.4, textAlign: "center" },
  emptyBody: { marginTop: 6, fontSize: 13, lineHeight: 19, textAlign: "center" },
  emptyPlate: { marginTop: 18 },

  program: { marginTop: 24 },
  programHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  programHeadTap: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 },
  programName: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    paddingVertical: 4,
  },
  programCount: { fontSize: 11, fontVariant: ["tabular-nums"] },
  programRule: { marginTop: 7, height: 1, borderRadius: 1 },
  board: { marginTop: 14 },

  addTile: {
    height: ADD_TILE_H,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addRing: {
    height: 30,
    width: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontSize: 12.5 },

  browse: {
    marginTop: 26,
    alignSelf: "center",
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  browseText: { fontSize: 12.5 },

  historyWrap: { marginTop: 22 },
  empty: { fontSize: 12.5, textAlign: "center", paddingVertical: 20 },
});
