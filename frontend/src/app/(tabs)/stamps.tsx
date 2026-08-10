import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { useCardRadius } from "@/features/style/store";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { useWeekDigest } from "@/features/digest/api";
import { WeekCard } from "@/features/digest/components/WeekCard";
import { useMonthAttachments } from "@/features/tasks/api";
import { monthGrid, monthRange } from "@/features/trackers/album";
import { AlbumGrid, type DayArt } from "@/features/trackers/components/AlbumGrid";
import { TrackerRoll } from "@/features/trackers/components/TrackerRoll";
import { liveTrackers, useEntriesRange, useTrackers } from "@/features/trackers/api";
import { formatValue, type Entry, type Tracker } from "@/features/trackers/types";
import { useMonthWorkoutPhotos, useWorkouts } from "@/features/workouts/api";
import { MuscleMap } from "@/features/workouts/components/MuscleMap";
import { focusOf } from "@/features/workouts/focus";
import { useCardInk } from "@/features/workouts/hues";
import { useLiveBarInset } from "@/features/workouts/live-bar";
import type { Workout } from "@/features/workouts/types";
import { localDate, localDateOf, nextMonth, toLocalNoon } from "@/lib/dates";
import { hapticTap } from "@/lib/haptics";
import { settle } from "@/lib/motion";
import { usePagePadding } from "@/lib/shell";
import { useGardenStore } from "@/stores/garden";
import { usePalette, useType } from "@/stores/theme";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** "YYYY-MM" one month back. `nextMonth` exists; this is its mirror. */
function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const monthTitle = (month: string) =>
  toLocalNoon(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Stamps: the album.
 *
 * Nothing is logged here and nothing is edited here. Putting things in happens
 * on Today, where the day already knows what "now" means; this is the page you
 * turn to afterwards to see what you have collected.
 *
 * It is a *picture* of a month rather than a list of one. A day you drew on
 * shows the drawing, a day you photographed shows the photo, a day you trained
 * shows the body you worked — because this app is looked at, and a table of
 * counts would be the same information with all the pleasure taken out. */
export default function Stamps() {
  const colors = usePalette();
  const type = useType();
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);

  const today = localDate();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [open, setOpen] = useState("");

  const { from, to } = useMemo(() => monthRange(month), [month]);
  const { data: all } = useTrackers();
  const { data: entries, isPending } = useEntriesRange(from, to);
  const { data: workouts } = useWorkouts();
  const { data: taskPhotos } = useMonthAttachments(month);
  const { data: gymPhotos } = useMonthWorkoutPhotos(month);
  const signatures = useGardenStore((s) => s.signatures);
  const { digest } = useWeekDigest(today);

  // A day's pictures, wherever they came from: something photographed onto a
  // task, and the shot taken when a session was filed. The album has no
  // business knowing the difference.
  const photos = useMemo(() => {
    const byDay: Record<string, string[]> = {};
    for (const src of [taskPhotos, gymPhotos]) {
      for (const [day, uris] of Object.entries(src ?? {})) (byDay[day] ??= []).push(...uris);
    }
    return byDay;
  }, [taskPhotos, gymPhotos]);

  const kept = liveTrackers(all);

  const rows = useMemo(
    () =>
      monthGrid({
        month,
        entries: entries ?? [],
        trackers: kept,
        workoutDays: (workouts ?? [])
          .filter((w) => w.ended_at)
          .map((w) => ({ date: localDateOf(w.started_at), id: w.id })),
        today,
      }),
    // `kept` is rebuilt each render from the query's data, so the query's data
    // is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, entries, all, workouts, today],
  );

  const art = (date: string): DayArt => ({
    photos: photos[date] ?? [],
    doodle: signatures[date],
  });

  const step = (next: string) => {
    hapticTap();
    setMonth(next);
    setOpen("");
  };

  const inMonth = (entries ?? []).filter((e) => localDateOf(e.at).startsWith(month));
  const nothing = !isPending && inMonth.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="stamps" />} title="Stamps" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: page.paddingBottom }]}
      >
        <Panel style={styles.calendar}>
          <View style={styles.monthRow}>
            <PressableScale
              scaleTo={0.85}
              accessibilityLabel={`Back to ${monthTitle(prevMonth(month))}`}
              onPress={() => step(prevMonth(month))}
              style={styles.arrow}
            >
              <ChevronLeft size={18} color={colors.inkMuted} />
            </PressableScale>
            <Text style={[styles.monthTitle, type.display, { color: colors.ink }]}>
              {monthTitle(month)}
            </Text>
            <PressableScale
              scaleTo={0.85}
              accessibilityLabel={`On to ${monthTitle(nextMonth(month))}`}
              onPress={() => step(nextMonth(month))}
              style={styles.arrow}
            >
              <ChevronRight size={18} color={colors.inkMuted} />
            </PressableScale>
          </View>

          <AlbumGrid
            rows={rows}
            art={art}
            selected={open}
            onPick={(d) => setOpen((cur) => (cur === d ? "" : d))}
          />
        </Panel>

        <View style={styles.summaryRow}>
          <Eyebrow>this month</Eyebrow>
          <Text style={[styles.count, type.sans, { color: colors.inkMuted }]}>
            {inMonth.length} {inMonth.length === 1 ? "stamp" : "stamps"}
          </Text>
        </View>

        {open ? (
          <Animated.View key={open} layout={settle()} entering={FadeIn.duration(160)}>
            <DayPage
              date={open}
              entries={entries ?? []}
              trackers={all ?? []}
              workouts={workouts ?? []}
              photos={photos[open] ?? []}
              doodle={signatures[open]}
            />
          </Animated.View>
        ) : nothing ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyLine, type.display, { color: colors.ink }]}>
              Nothing in this month.
            </Text>
            <Text style={[styles.emptyHint, type.sans, { color: colors.inkMuted }]}>
              Log something on Today and it lands here. It fills up faster than you would think.
            </Text>
          </View>
        ) : (
          <Text style={[styles.pickHint, type.sans, { color: colors.inkMuted }]}>
            Pick a day to see what it was.
          </Text>
        )}

        {/* This week, counted. It sits under the album rather than above it
            because the pictures are what this page is for; the numbers are
            what you come down to afterwards. Always the current week, never
            the month being browsed: "your week" means the one you are in. */}
        {digest && <WeekCard digest={digest} />}

        {/* The standing achievements, under the month they were earned in.
            It loads its own half-year, so paging back to July cannot make a
            run look shorter than it is. */}
        <TrackerRoll trackers={kept} today={today} />
      </ScrollView>
    </View>
  );
}

/** One day, opened: what it looked like, what you worked, and what you said.
 *
 * Read only. This is the record, and the record is not where you change your
 * mind — that happens on Today, on the day itself. */
function DayPage({
  date,
  entries,
  trackers,
  workouts,
  photos,
  doodle,
}: {
  date: string;
  entries: Entry[];
  trackers: Tracker[];
  workouts: Workout[];
  photos: string[];
  doodle: ReturnType<typeof useGardenStore.getState>["signatures"][string] | undefined;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const radius = useCardRadius();
  const router = useRouter();

  const byId = new Map(trackers.map((t) => [t.id, t]));
  const mine = entries.filter((e) => localDateOf(e.at) === date);
  const sessions = workouts.filter((w) => w.ended_at && localDateOf(w.started_at) === date);
  const focus = sessions.map((w) => focusOf(w.entries)).find((f) => f) ?? null;

  return (
    <Panel style={styles.dayPanel}>
      <Text style={[styles.dayTitle, type.display, { color: colors.ink }]}>
        {toLocalNoon(date).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </Text>

      {(photos.length > 0 || !!doodle?.length || !!focus) && (
        <View style={styles.plate}>
          {photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={[styles.plateShot, { borderRadius: radius }]} />
          ))}
          {/* The body you worked, in the hue that session came out — the same
              figure the gym draws, so the two can never disagree about what a
              day hit. */}
          {!!focus && (
            <View
              style={[
                styles.plateBody,
                { backgroundColor: ink(focus.hueKey).field, borderRadius: radius },
              ]}
            >
              <MuscleMap
                targets={focus.targets}
                secondary={focus.secondary}
                scale={0.34}
                tint={ink(focus.hueKey).solid}
              />
            </View>
          )}
        </View>
      )}

      {sessions.map((w) => (
        <PressableScale
          key={w.id}
          scaleTo={0.98}
          accessibilityLabel={`Open ${w.title}`}
          onPress={() => router.push({ pathname: "/workout/[id]", params: { id: w.id } })}
          style={styles.row}
        >
          <View style={styles.slot}>
            <Dumbbell size={13} color={colors.inkMuted} />
          </View>
          <Text numberOfLines={1} style={[styles.rowBody, type.sans, { color: colors.ink }]}>
            {w.title}
            {focus ? ` · ${focus.label}` : ""}
          </Text>
        </PressableScale>
      ))}

      {mine.map((entry) => {
        const tracker = byId.get(entry.tracker);
        if (!tracker) return null;
        const measured = formatValue(tracker, entry.value);
        return (
          <View key={entry.id} style={styles.row}>
            <View style={styles.slot}>
              <Stamp color={ink(tracker.hue).stamp} rotate={-3}>
                {timeOf(entry.at)}
              </Stamp>
            </View>
            <Text style={[styles.rowBody, type.sans, { color: colors.ink }]}>
              {[measured, entry.body].filter(Boolean).join(" · ") || tracker.name}
            </Text>
          </View>
        );
      })}

      {mine.length === 0 && sessions.length === 0 && (
        <Text style={[styles.rowBody, type.sans, { color: colors.inkMuted }]}>
          Nothing logged, but you drew on it.
        </Text>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8 },
  scroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  calendar: { padding: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 },
  arrow: { height: 34, width: 34, alignItems: "center", justifyContent: "center" },
  monthTitle: { fontSize: 17, letterSpacing: -0.2 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  count: { fontSize: 12, fontVariant: ["tabular-nums"] },
  dayPanel: { padding: 16, gap: 10 },
  dayTitle: { fontSize: 18, letterSpacing: -0.3 },
  plate: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  plateShot: { height: 120, width: 100 },
  plateBody: { height: 120, width: 100, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  slot: { width: 62, alignItems: "flex-start" },
  rowBody: { flex: 1, fontSize: 14, lineHeight: 20 },
  empty: { paddingHorizontal: 4, paddingTop: 6, gap: 4 },
  emptyLine: { fontSize: 20, letterSpacing: -0.4 },
  emptyHint: { fontSize: 13.5, lineHeight: 19 },
  pickHint: { paddingHorizontal: 4, fontSize: 13 },
});
