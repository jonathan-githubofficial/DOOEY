import { Trash2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Grain } from "@/components/grain";
import { Masthead } from "@/components/Masthead";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp, StampButton } from "@/components/surface";
import { useAddEntry, useDeleteEntry, useEditEntry, useJournalDay } from "@/features/journal/api";
import type { JournalEntry } from "@/features/journal/types";
import { PageDoodle } from "@/features/style/components/PageDoodle";
import { useCardInk } from "@/features/workouts/hues";
import { confirmDestructive } from "@/lib/confirm";
import { localDate } from "@/lib/dates";
import { hapticTap } from "@/lib/haptics";
import { settle } from "@/lib/motion";
import { usePagePadding } from "@/lib/shell";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { useLiveBarInset } from "@/features/workouts/live-bar";

/** Food is honey — the warm one. Every shade on the page derives from that
 * palette token, so retuning it in the Style studio repaints the space. */
const HUE = "honey";

/** The day in four parts. Grouping by these gives the page its shape and
 * answers "have I eaten this morning?" without reading a single timestamp. */
const PARTS = [
  { until: 11, label: "morning" },
  { until: 16, label: "afternoon" },
  { until: 21, label: "evening" },
  { until: 24, label: "late" },
] as const;

const partOf = (iso: string) => {
  const h = new Date(iso).getHours();
  return PARTS.find((p) => h < p.until) ?? PARTS[PARTS.length - 1];
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The Journal: what you ate today, in your own words. Type it, stamp it, done.
 * Nothing is parsed, counted or scored — the whole point is that logging costs
 * one line of thought, so the page is a pad and a rubber stamp, not a form. */
export default function Journal() {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk()(HUE);
  const liveInset = useLiveBarInset();
  const page = usePagePadding(liveInset);

  const today = localDate();
  const { data: entries, isPending } = useJournalDay(today);
  const add = useAddEntry(today);

  const field = useRef<TextInput>(null);
  const [draft, setDraft] = useState("");
  const ready = draft.trim().length > 0;

  const log = () => {
    if (!ready) return;
    hapticTap();
    add.mutate(draft.trim());
    setDraft("");
    // Meals arrive in bursts — keep the cursor so the next line costs nothing.
    field.current?.focus();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: page.paddingTop }]}>
      <Grain />
      <View style={styles.head}>
        <Masthead avatar={<PageDoodle page="journal" />} title="Journal" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: page.paddingBottom }]}
      >
        <Panel style={[styles.composer, { backgroundColor: ink.field }]}>
          <Eyebrow>ate just now</Eyebrow>
          <TextInput
            ref={field}
            value={draft}
            onChangeText={setDraft}
            placeholder="two eggs and toast"
            placeholderTextColor={alpha(colors.inkMuted, 0.55)}
            multiline
            style={[styles.input, type.sans, { color: colors.ink }]}
          />
          {/* A stamp, not a Save button: the one shape in DOOEY that looks
              licked and pressed down rather than clicked. */}
          <View style={styles.stampRow}>
            <StampButton color={ink.solid} disabled={!ready} onPress={log}>
              <Text style={[styles.stampText, type.sansSemiBold, { color: colors.paper }]}>
                Log it
              </Text>
            </StampButton>
          </View>
        </Panel>

        {!isPending && (entries?.length ?? 0) === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyLine, type.display, { color: colors.ink }]}>
              Nothing logged today.
            </Text>
            <Text style={[styles.emptyHint, type.sans, { color: colors.inkMuted }]}>
              A few words is plenty — you can always add to it later.
            </Text>
          </View>
        )}

        {entries?.map((entry, i) => {
          const part = partOf(entry.eaten_at);
          const opensPart = i === 0 || partOf(entries[i - 1].eaten_at).label !== part.label;
          return (
            <Animated.View key={entry.id} layout={settle()} entering={FadeIn.duration(180)}>
              {opensPart && <Eyebrow style={styles.partHead}>{part.label}</Eyebrow>}
              <EntryRow entry={entry} date={today} stamp={ink.stamp} />
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** One logged entry: the hour stamped beside the words you used. Editing is in
 * place and commits on blur — there is nothing to confirm about a sentence. */
function EntryRow({
  entry,
  date,
  stamp,
}: {
  entry: JournalEntry;
  date: string;
  stamp: string;
}) {
  const colors = usePalette();
  const type = useType();
  const edit = useEditEntry(date);
  const remove = useDeleteEntry(date);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const next = (draft ?? "").trim();
    if (draft !== null && next && next !== entry.body) edit.mutate({ id: entry.id, body: next });
    setDraft(null);
  };

  return (
    <Panel style={styles.entry}>
      <Stamp color={stamp} rotate={-3} style={styles.time}>
        {timeOf(entry.eaten_at)}
      </Stamp>
      <TextInput
        value={draft ?? entry.body}
        onChangeText={setDraft}
        onBlur={commit}
        accessibilityLabel={`Edit "${entry.body}"`}
        multiline
        style={[styles.body, type.sans, { color: colors.ink }]}
      />
      <PressableScale
        scaleTo={0.85}
        accessibilityLabel={`Delete "${entry.body}"`}
        hitSlop={8}
        onPress={() =>
          confirmDestructive("Delete this entry?", entry.body, "Delete", () =>
            remove.mutate(entry.id),
          )
        }
        style={styles.drop}
      >
        <Trash2 size={14} color={alpha(colors.inkMuted, 0.55)} />
      </PressableScale>
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  composer: { padding: 16, gap: 4, overflow: "hidden" },
  input: { fontSize: 17, minHeight: 28, paddingVertical: 2 },
  stampRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6 },
  stampText: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  empty: { paddingHorizontal: 4, paddingTop: 10, gap: 4 },
  emptyLine: { fontSize: 20, letterSpacing: -0.4 },
  emptyHint: { fontSize: 13.5 },
  partHead: { marginTop: 12, marginBottom: 6, marginLeft: 4 },
  entry: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  time: { marginTop: 1 },
  body: { flex: 1, fontSize: 15.5, paddingVertical: 0, lineHeight: 21 },
  drop: { paddingTop: 3 },
});
