import { Sparkles } from "lucide-react-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { formatDuration } from "@/features/trackers/types";
import { hapticTap } from "@/lib/haptics";
import { dur } from "@/lib/motion";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useNarrateWeek } from "../api";
import type { Digest, TrackerDigest } from "../digest";

/** The week, counted.
 *
 * Numbers first and always: they come from `digestOf`, they are on screen
 * before anything is asked of a model, and they stay there if the writing
 * never arrives. The paragraph is the optional part, which is the right way
 * round — a summary you cannot trust is worse than no summary, and the only
 * part of this that could be wrong is the prose.
 *
 * **Deltas are not coloured.** `leaf` means done in this app and `clay` means
 * something is wrong, and neither is true of a number that moved. More sleep
 * is good, more weight might not be, more tasks finished says nothing about
 * the week you actually had. Tinting a delta green would be the app asserting
 * a judgement it has no way to earn, so a change is just an arrow and a
 * number in muted ink, and what it means is left to the person who lived it. */
export function WeekCard({ digest }: { digest: Digest }) {
  const colors = usePalette();
  const type = useType();
  const narrate = useNarrateWeek();

  if (digest.empty) {
    return (
      <Panel style={styles.panel}>
        <Eyebrow>your week</Eyebrow>
        <Text style={[styles.quiet, type.sans, { color: colors.inkMuted }]}>
          Nothing logged this week yet. It fills as you go.
        </Text>
      </Panel>
    );
  }

  const { tasks, workouts, trackers, quiet } = digest;

  return (
    <Panel style={styles.panel}>
      <Eyebrow>your week</Eyebrow>

      <View style={styles.tallies}>
        <Tally n={tasks.done} label={tasks.done === 1 ? "task done" : "tasks done"} delta={tasks.doneDelta} />
        {workouts.count > 0 && (
          <Tally
            n={workouts.count}
            label={workouts.count === 1 ? "session" : "sessions"}
            delta={workouts.countDelta}
          />
        )}
        {tasks.unfinished > 0 && <Tally n={tasks.unfinished} label="still open" />}
      </View>

      {workouts.focus.length > 0 && (
        <Text style={[styles.line, type.sans, { color: colors.inkMuted }]}>
          {workouts.focus.map((f) => (f.count > 1 ? `${f.label} ×${f.count}` : f.label)).join(", ")}
          {workouts.minutes > 0 ? ` · ${formatDuration(workouts.minutes)}` : ""}
        </Text>
      )}

      {trackers.length > 0 && (
        <View style={[styles.rows, { borderTopColor: alpha(colors.rule, 0.5) }]}>
          {trackers.map((t) => (
            <TrackerRow key={t.slug} tracker={t} />
          ))}
        </View>
      )}

      {quiet.length > 0 && (
        <Text style={[styles.line, type.sans, { color: colors.inkMuted }]}>
          Nothing logged for {quiet.join(", ")} this week.
        </Text>
      )}

      {/* Asked for, never automatic: it costs money and a paragraph nobody
          wanted is a paragraph nobody reads. */}
      {narrate.data ? (
        <Animated.View
          entering={FadeIn.duration(dur.quick)}
          style={[styles.prose, { borderTopColor: alpha(colors.rule, 0.5) }]}
        >
          <Text style={[styles.proseText, type.sans, { color: colors.ink }]}>{narrate.data}</Text>
        </Animated.View>
      ) : (
        <PressableScale
          scaleTo={0.98}
          accessibilityLabel="Read the week back to me"
          disabled={narrate.isPending}
          onPress={() => {
            hapticTap();
            narrate.mutate(digest);
          }}
          style={[
            styles.ask,
            { borderColor: alpha(colors.zest, 0.4), backgroundColor: alpha(colors.zest, 0.08) },
          ]}
        >
          {narrate.isPending ? (
            <ActivityIndicator size="small" color={colors.zest} />
          ) : (
            <Sparkles size={15} color={colors.zest} />
          )}
          <Text style={[styles.askText, type.sansMedium, { color: colors.ink }]}>
            {narrate.isPending ? "Reading it back…" : "Read this back to me"}
          </Text>
        </PressableScale>
      )}

      {narrate.isError && (
        <Text style={[styles.line, type.sans, { color: colors.inkMuted }]}>
          Couldn&rsquo;t reach the writer. The numbers above are unaffected.
        </Text>
      )}
    </Panel>
  );
}

/** One big number and what it counts. */
function Tally({ n, label, delta }: { n: number; label: string; delta?: number }) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.tally}>
      <Text style={[styles.tallyN, type.display, { color: colors.ink }]}>{n}</Text>
      <Text style={[styles.tallyLabel, type.sans, { color: colors.inkMuted }]}>{label}</Text>
      <Delta value={delta ?? null} />
    </View>
  );
}

function TrackerRow({ tracker }: { tracker: TrackerDigest }) {
  const colors = usePalette();
  const type = useType();
  const summary = readingOf(tracker);

  return (
    <View style={styles.row}>
      <Text numberOfLines={1} style={[styles.rowName, type.sansMedium, { color: colors.ink }]}>
        {tracker.name}
      </Text>
      <Text style={[styles.rowValue, type.sans, { color: colors.inkMuted }]}>{summary}</Text>
      <Delta value={tracker.meanDelta} unit={tracker.shape === "duration" ? "min" : tracker.unit} />
    </View>
  );
}

/** What a tracker did this week, in one phrase. A measured tracker leads with
 * its average, because that is the question people ask of a week; words and
 * ticks have nothing to average, so they lead with how often. */
function readingOf(t: TrackerDigest): string {
  const days = `${t.daysLogged} ${t.daysLogged === 1 ? "day" : "days"}`;
  if (t.mean === null) return `${t.count}× · ${days}`;
  return `${meanOf(t)} avg · ${days}`;
}

function meanOf(t: TrackerDigest): string {
  const mean = t.mean ?? 0;
  if (t.shape === "duration") return formatDuration(mean);
  if (t.shape === "scale") return `${mean} of ${t.scaleMax}`;
  return t.unit ? `${mean} ${t.unit}` : String(mean);
}

/** A change, or nothing at all.
 *
 * `null` means the digest refused to compare — fewer than `MIN_FOR_MEAN`
 * readings on one side — and it renders as **silence**, never as "0". Showing
 * no change where there is not enough evidence to know is the same lie as
 * showing a made-up one. */
function Delta({ value, unit }: { value: number | null; unit?: string }) {
  const colors = usePalette();
  const type = useType();
  if (value === null || value === 0) return null;
  const sign = value > 0 ? "↑" : "↓";
  const size = Math.abs(value);
  const shown = unit === "min" ? formatDuration(size) : `${size}${unit ? ` ${unit}` : ""}`;
  return (
    <Text style={[styles.delta, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
      {sign} {shown}
    </Text>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 16, padding: 20 },
  quiet: { marginTop: 8, fontSize: 13.5, lineHeight: 19 },
  tallies: { marginTop: 12, flexDirection: "row", gap: 24 },
  tally: { minWidth: 0 },
  tallyN: { fontSize: 30, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
  tallyLabel: { marginTop: -2, fontSize: 12 },
  line: { marginTop: 10, fontSize: 12.5, lineHeight: 18 },
  rows: { marginTop: 14, borderTopWidth: 1, paddingTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  rowName: { flex: 1, minWidth: 0, fontSize: 14 },
  rowValue: { fontSize: 12.5, fontVariant: ["tabular-nums"] },
  delta: { fontSize: 11.5, fontVariant: ["tabular-nums"] },
  prose: { marginTop: 14, borderTopWidth: 1, paddingTop: 12 },
  proseText: { fontSize: 14, lineHeight: 21 },
  ask: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
  },
  askText: { fontSize: 13.5 },
});
