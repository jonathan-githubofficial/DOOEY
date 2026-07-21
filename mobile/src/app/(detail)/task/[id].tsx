import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Link2,
  ListChecks,
  Paperclip,
  Play,
  Plus,
  StickyNote,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check } from "@/components/Check";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp } from "@/components/surface";
import { attachmentUrl, useDeleteTask, useTask, useUpdateTask } from "@/features/tasks/api";
import type { ChecklistItem, Resource, Task } from "@/features/tasks/types";
import { dateOnly, toLocalNoon } from "@/lib/dates";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";

const settle = LinearTransition.springify().stiffness(420).damping(32);

/** A task's page: the same fixed, structured sections as the web app — notes,
 * checklist, resources, attachments. Every edit saves as you leave the field. */
export default function TaskPage() {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: task } = useTask(id);
  const del = useDeleteTask();

  return (
    <View style={[styles.screen, { backgroundColor: colors.paper, paddingTop: insets.top + 12 }]}>
      <Grain />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(16, insets.bottom) + 96 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headRow}>
          <PressableScale
            scaleTo={0.85}
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={styles.back}
          >
            <ChevronLeft size={22} color={colors.inkMuted} />
          </PressableScale>
          {task && (
            <Pressable
              accessibilityLabel="Delete task"
              hitSlop={8}
              onPress={() =>
                Alert.alert("Delete task", `Delete "${task.title}"?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      del.mutate(task.id);
                      router.back();
                    },
                  },
                ])
              }
            >
              <Trash2 size={16} color={alpha(colors.inkMuted, 0.7)} />
            </Pressable>
          )}
        </View>

        {task && <TaskBody task={task} />}
      </ScrollView>
    </View>
  );
}

const SECTIONS = [
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "checklist", label: "Checklist", icon: ListChecks },
  { key: "resources", label: "Resources", icon: Link2 },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

/** The page body, legacy-web style: sections only exist once they hold
 * something — the empty ones wait behind a row of dashed add-keys. */
function TaskBody({ task }: { task: Task }) {
  const [opened, setOpened] = useState<Set<SectionKey>>(new Set());

  const visible: Record<SectionKey, boolean> = {
    notes: !!task.notes || opened.has("notes"),
    checklist: task.checklist.length > 0 || opened.has("checklist"),
    resources: task.resources.length > 0 || opened.has("resources"),
  };
  const missing = SECTIONS.filter(({ key }) => !visible[key]);

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <TaskHead task={task} />
      {visible.notes && <NotesSection task={task} autoFocus={opened.has("notes") && !task.notes} />}
      {visible.checklist && (
        <ChecklistSection
          task={task}
          autoFocus={opened.has("checklist") && task.checklist.length === 0}
        />
      )}
      {visible.resources && (
        <ResourcesSection
          task={task}
          autoFocus={opened.has("resources") && task.resources.length === 0}
        />
      )}
      {task.attachments.length > 0 && <AttachmentsSection task={task} />}

      {missing.length > 0 && (
        <View style={styles.addKeys}>
          {missing.map(({ key, label, icon }) => (
            <AddSectionKey
              key={key}
              label={label}
              icon={icon}
              onPress={() => {
                hapticTap();
                setOpened((s) => new Set(s).add(key));
              }}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** A dashed, waiting circle — tap it and the section takes its place. */
function AddSectionKey({
  label,
  icon: IconGlyph,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      scaleTo={0.85}
      accessibilityLabel={`Add ${label.toLowerCase()}`}
      onPress={onPress}
      style={[styles.addKey, { borderColor: alpha(colors.rule, 0.9) }]}
    >
      <IconGlyph size={14} color={alpha(colors.inkMuted, 0.6)} />
    </PressableScale>
  );
}

function TaskHead({ task }: { task: Task }) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const isDone = !!task.done_at;

  return (
    <View style={styles.head}>
      <View style={styles.headTitleRow}>
        <Check
          done={isDone}
          gate={task.gate}
          label={isDone ? "Mark not done" : "Mark done"}
          size={26}
          onToggle={() =>
            update.mutate({
              id: task.id,
              patch: { done_at: isDone ? "" : new Date().toISOString() },
            })
          }
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          onEndEditing={() => {
            const t = title.trim();
            if (t && t !== task.title) update.mutate({ id: task.id, patch: { title: t } });
          }}
          multiline
          style={[styles.title, type.display, { color: colors.ink }]}
        />
      </View>
      {!!task.due_date && (
        <View style={styles.stampRow}>
          <Stamp rotate={-3} color={alpha(colors.inkMuted, 0.8)}>
            {toLocalNoon(dateOnly(task.due_date)).toLocaleDateString("en", {
              month: "short",
              day: "numeric",
            })}
          </Stamp>
        </View>
      )}
      <TextInput
        value={description}
        onChangeText={setDescription}
        onEndEditing={() => {
          if (description.trim() !== task.description)
            update.mutate({ id: task.id, patch: { description: description.trim() } });
        }}
        placeholder="A one-liner under the title…"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        style={[styles.description, type.sans, { color: colors.inkMuted }]}
      />
    </View>
  );
}

function NotesSection({ task, autoFocus }: { task: Task; autoFocus?: boolean }) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  const [notes, setNotes] = useState(task.notes);
  return (
    <Panel style={styles.panel}>
      <Eyebrow>notes</Eyebrow>
      <TextInput
        autoFocus={autoFocus}
        value={notes}
        onChangeText={setNotes}
        onEndEditing={() => {
          if (notes !== task.notes) update.mutate({ id: task.id, patch: { notes } });
        }}
        placeholder="Anything worth keeping…"
        placeholderTextColor={alpha(colors.inkMuted, 0.5)}
        multiline
        style={[styles.notes, type.sans, { color: colors.ink }]}
      />
    </Panel>
  );
}

function ChecklistSection({ task, autoFocus }: { task: Task; autoFocus?: boolean }) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  const [draft, setDraft] = useState("");
  const items = task.checklist;
  const ticked = items.filter((i) => i.done).length;

  const save = (checklist: ChecklistItem[]) =>
    update.mutate({ id: task.id, patch: { checklist } });

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    save([...items, { id: `${Date.now()}`, label, done: false }]);
    setDraft("");
  };

  return (
    <Panel style={styles.panel}>
      <View style={styles.panelHead}>
        <Eyebrow>checklist</Eyebrow>
        {items.length > 0 && (
          <Text style={[styles.progress, type.sans, { color: colors.inkMuted }]}>
            {ticked}/{items.length}
          </Text>
        )}
      </View>
      <View style={styles.itemList}>
        {items.map((item) => (
          <Animated.View key={item.id} layout={settle} exiting={FadeOut.duration(140)} style={styles.itemRow}>
            <Check
              done={item.done}
              label={item.label}
              size={20}
              onToggle={() =>
                save(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
              }
            />
            <Text
              style={[
                styles.itemLabel,
                type.sans,
                { color: item.done ? colors.inkMuted : colors.ink },
                item.done && { textDecorationLine: "line-through" },
              ]}
            >
              {item.label}
            </Text>
            <Pressable
              accessibilityLabel={`Remove "${item.label}"`}
              hitSlop={8}
              onPress={() => save(items.filter((i) => i.id !== item.id))}
            >
              <X size={13} color={alpha(colors.inkMuted, 0.5)} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          autoFocus={autoFocus}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Add a step…"
          placeholderTextColor={alpha(colors.inkMuted, 0.5)}
          returnKeyType="done"
          submitBehavior="submit"
          style={[styles.addInput, type.sans, { color: colors.ink }]}
        />
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Add step"
          onPress={add}
          disabled={!draft.trim()}
          style={[
            styles.addBtn,
            { backgroundColor: alpha(colors.zest, 0.15) },
            !draft.trim() && { opacity: 0.4 },
          ]}
        >
          <Plus size={16} color={colors.zest} />
        </PressableScale>
      </View>
    </Panel>
  );
}

function ResourcesSection({ task, autoFocus }: { task: Task; autoFocus?: boolean }) {
  const colors = usePalette();
  const type = useType();
  const update = useUpdateTask();
  const [draft, setDraft] = useState("");
  const resources = task.resources;

  const save = (next: Resource[]) => update.mutate({ id: task.id, patch: { resources: next } });

  const add = () => {
    let url = draft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const kind: Resource["kind"] = /youtube\.com|youtu\.be/i.test(url) ? "youtube" : "link";
    const label = url.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0];
    save([...resources, { id: `${Date.now()}`, url, label, kind }]);
    setDraft("");
  };

  return (
    <Panel style={styles.panel}>
      <Eyebrow>resources</Eyebrow>
      <View style={styles.itemList}>
        {resources.map((r) => (
          <Animated.View key={r.id} layout={settle} exiting={FadeOut.duration(140)} style={styles.itemRow}>
            {r.kind === "youtube" ? (
              <Play size={16} color={colors.clay} />
            ) : (
              <Link2 size={15} color={colors.sky} />
            )}
            <Pressable style={styles.itemBody} onPress={() => Linking.openURL(r.url)}>
              <Text numberOfLines={1} style={[styles.itemLabel, type.sansMedium, { color: colors.ink }]}>
                {r.label}
              </Text>
              <Text numberOfLines={1} style={[styles.itemUrl, type.sans, { color: colors.inkMuted }]}>
                {r.url}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Remove ${r.label}`}
              hitSlop={8}
              onPress={() => save(resources.filter((x) => x.id !== r.id))}
            >
              <X size={13} color={alpha(colors.inkMuted, 0.5)} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          autoFocus={autoFocus}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Paste a link…"
          placeholderTextColor={alpha(colors.inkMuted, 0.5)}
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="done"
          submitBehavior="submit"
          style={[styles.addInput, type.sans, { color: colors.ink }]}
        />
        <PressableScale
          scaleTo={0.85}
          accessibilityLabel="Add link"
          onPress={add}
          disabled={!draft.trim()}
          style={[
            styles.addBtn,
            { backgroundColor: alpha(colors.zest, 0.15) },
            !draft.trim() && { opacity: 0.4 },
          ]}
        >
          <Plus size={16} color={colors.zest} />
        </PressableScale>
      </View>
    </Panel>
  );
}

function AttachmentsSection({ task }: { task: Task }) {
  const colors = usePalette();
  const type = useType();
  if (task.attachments.length === 0) return null;
  return (
    <Panel style={styles.panel}>
      <Eyebrow>attachments</Eyebrow>
      <View style={styles.itemList}>
        {task.attachments.map((f) => (
          <Pressable
            key={f}
            style={styles.itemRow}
            onPress={() => Linking.openURL(attachmentUrl(task.id, f))}
          >
            <Paperclip size={14} color={colors.inkMuted} />
            <Text numberOfLines={1} style={[styles.itemLabel, type.sans, { color: colors.ink }]}>
              {f}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.attachHint, type.sans, { color: alpha(colors.inkMuted, 0.8) }]}>
        Add or remove files from the web app.
      </Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    height: 40,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  head: { marginTop: 4, paddingHorizontal: 4 },
  headTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5, paddingTop: 0 },
  stampRow: { marginTop: 10, flexDirection: "row" },
  description: { marginTop: 8, fontSize: 14 },
  panel: { marginTop: 16, padding: 20 },
  panelHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  progress: { fontSize: 12, fontVariant: ["tabular-nums"] },
  notes: { marginTop: 8, minHeight: 60, fontSize: 14, lineHeight: 21, textAlignVertical: "top" },
  itemList: { marginTop: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemLabel: { flex: 1, minWidth: 0, fontSize: 14 },
  itemUrl: { fontSize: 11, marginTop: 1 },
  addRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  addBtn: {
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  attachHint: { marginTop: 8, fontSize: 11 },
  addKeys: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
  },
  addKey: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
  },
});
