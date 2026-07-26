import { ExternalLink } from "lucide-react-native";
import { useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Grain } from "@/components/grain";
import { StampEdge } from "@/components/stamp-edge";
import { PressableScale } from "@/components/pressable-scale";
import { fontStyle } from "@/features/style/tokens";
import { strokePath, type Stroke } from "@/lib/doodle";
import { alpha, type Palette } from "@/lib/theme";
import { usePalette, useElevation, useType } from "@/stores/theme";
import { usePhotoDrafts } from "../store";
import { boardPhotoUrl } from "../api";
import {
  DEFAULT_W,
  SECTION_HEAD_H,
  SECTION_RADIUS,
  TEXT_DEFAULTS,
  widthOf,
  type BoardItem,
  type LinkItem,
  type NoteItem,
  type PhotoItem,
  type SectionItem,
  type TextItem,
} from "../types";

/** A doodle drawn at a given width, keeping its own proportions. Strokes are
 * normalized so `aspect` alone decides the box. */
export function DoodleArt({
  strokes,
  aspect,
  width,
  strokeWidth = 2.4,
}: {
  strokes: Stroke[];
  aspect: number;
  width: number;
  strokeWidth?: number;
}) {
  const colors = usePalette();
  const height = width / aspect;
  return (
    <Svg width={width} height={height} viewBox={`0 0 100 ${100 / aspect}`}>
      {strokes.map((s, i) => (
        <Path
          key={i}
          d={strokePath(s.points)}
          fill="none"
          stroke={colors[s.color as keyof Palette] ?? colors.ink}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        />
      ))}
    </Svg>
  );
}

/** What a piece looks like on the board.
 *
 * Everything that can be typed into is typed into *here*, on the canvas, in
 * the place the words will live. `editing` is the parent's say-so: until then
 * the field is inert so the whole piece drags as one object, which is what a
 * finger landing on a note expects. */
export function ItemBody({
  boardId,
  item,
  editing,
  onText,
  onLink,
  onEditEnd,
}: {
  boardId: string;
  item: BoardItem;
  editing: boolean;
  onText: (text: string) => void;
  onLink: (patch: { url?: string; label?: string }) => void;
  onEditEnd: () => void;
}) {
  switch (item.kind) {
    case "note":
      return <NoteBody item={item} editing={editing} onText={onText} onEditEnd={onEditEnd} />;
    case "text":
      return <TextBody item={item} editing={editing} onText={onText} onEditEnd={onEditEnd} />;
    case "link":
      return <LinkBody item={item} editing={editing} onLink={onLink} onEditEnd={onEditEnd} />;
    case "sticker":
      return <StickerBody emoji={item.emoji} w={widthOf(item)} />;
    case "photo":
      return <PhotoBody boardId={boardId} item={item} />;
    case "doodle":
      return <DoodleArt strokes={item.strokes} aspect={item.aspect} width={item.w} />;
    case "section":
      return <SectionBody item={item} editing={editing} onText={onText} onEditEnd={onEditEnd} />;
  }
}

/** A sticky note. Real paper colour, real grain, and the words sit directly on
 * it — there is no "open the note" step because there is nothing to open. */
function NoteBody({
  item,
  editing,
  onText,
  onEditEnd,
}: {
  item: NoteItem;
  editing: boolean;
  onText: (text: string) => void;
  onEditEnd: () => void;
}) {
  const colors = usePalette();
  const elevation = useElevation();
  // The canvas owns the box (it animates the width during a resize); the note
  // fills whatever it is given.
  return (
    <View style={[styles.note, elevation, { backgroundColor: alpha(colors[item.color], 0.35) }]}>
      <Grain radius={3} />
      <InlineInput
        value={item.text}
        editing={editing}
        placeholder="Write…"
        onCommit={onText}
        onEditEnd={onEditEnd}
        style={[styles.noteText, fontStyle("outfit", "400"), { color: colors.ink }]}
      />
    </View>
  );
}

/** Words placed straight on the paper, no card. The corner handle scales the
 * type with the box, so a headline is made by dragging it bigger. */
function TextBody({
  item,
  editing,
  onText,
  onEditEnd,
}: {
  item: TextItem;
  editing: boolean;
  onText: (text: string) => void;
  onEditEnd: () => void;
}) {
  const colors = usePalette();
  const size = item.size ?? TEXT_DEFAULTS.size;
  const family = item.font === "mono" ? "mono" : item.font === "body" ? "outfit" : "fraunces";
  const weightValue = item.weight ?? TEXT_DEFAULTS.weight;
  const weight = weightValue >= 800 ? "900" : weightValue >= 600 ? "700" : "400";
  return (
    <InlineInput
      value={item.text}
      editing={editing}
      placeholder="Say it big…"
      onCommit={onText}
      onEditEnd={onEditEnd}
      style={[
        {
          width: item.w,
          fontSize: size,
          lineHeight: size * 1.2,
          color: colors.ink,
          textAlign: item.align ?? TEXT_DEFAULTS.align,
        },
        fontStyle(family, weight),
      ]}
    />
  );
}

/** A link. Selected it offers Open; tapped again it becomes its own two-field
 * form, so a wrong url is fixed where it sits. */
function LinkBody({
  item,
  editing,
  onLink,
  onEditEnd,
}: {
  item: LinkItem;
  editing: boolean;
  onLink: (patch: { url?: string; label?: string }) => void;
  onEditEnd: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const elevation = useElevation();
  const [label, setLabel] = useState(item.label);
  const [url, setUrl] = useState(item.url);

  if (editing) {
    return (
      <View
        style={[
          styles.linkForm,
          elevation,
          { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
        ]}
      >
        <TextInput
          autoFocus
          value={label}
          onChangeText={setLabel}
          placeholder="Label"
          placeholderTextColor={alpha(colors.inkMuted, 0.6)}
          style={[styles.linkField, type.sans, { color: colors.ink, borderColor: alpha(colors.rule, 0.6) }]}
        />
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
          placeholderTextColor={alpha(colors.inkMuted, 0.6)}
          style={[styles.linkField, type.sans, { color: colors.ink, borderColor: alpha(colors.rule, 0.6) }]}
        />
        <PressableScale
          scaleTo={0.96}
          accessibilityLabel="Save link"
          onPress={() => {
            const clean = url.trim();
            onLink({ url: clean, label: label.trim() || clean || "Link" });
            onEditEnd();
          }}
          style={[styles.linkSave, { backgroundColor: colors.zest }]}
        >
          <Text style={[styles.linkSaveText, type.sansSemiBold, { color: colors.paper }]}>Done</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.link,
        elevation,
        { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
      ]}
    >
      <Grain radius={11} />
      <View style={[styles.linkIcon, { backgroundColor: alpha(colors.sky, 0.18) }]}>
        <ExternalLink size={15} color={colors.sky} />
      </View>
      <View style={styles.linkLines}>
        <Text numberOfLines={1} style={[styles.linkLabel, type.sansMedium, { color: colors.ink }]}>
          {item.label || "Link"}
        </Text>
        {!!item.url && (
          <Text numberOfLines={1} style={[styles.linkHost, type.sans, { color: colors.inkMuted }]}>
            {prettyUrl(item.url)}
          </Text>
        )}
      </View>
    </View>
  );
}

function StickerBody({ emoji, w }: { emoji: string; w: number }) {
  return <Text style={{ fontSize: w * 0.78, lineHeight: w * 0.95 }}>{emoji}</Text>;
}

/** A photo in one of three frames. The picked image shows immediately from its
 * local uri and swaps to the stored file once the upload lands, so choosing a
 * photo never means waiting for a progress bar. */
function PhotoBody({ boardId, item }: { boardId: string; item: PhotoItem }) {
  const colors = usePalette();
  const elevation = useElevation();
  const draft = usePhotoDrafts((d) => d[item.id]);
  const uri = draft ?? (item.file ? boardPhotoUrl(boardId, item.file) : null);
  const height = item.w / item.aspect;
  const image = uri ? (
    <Image
      source={{ uri }}
      style={{ width: item.w, height, borderRadius: item.frame === "plain" ? 8 : 2 }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{ width: item.w, height, borderRadius: 8, backgroundColor: alpha(colors.ink, 0.06) }}
    />
  );

  if (item.frame === "polaroid") {
    return (
      <View style={[styles.polaroid, elevation, { backgroundColor: colors.surface }]}>
        <Grain radius={2} />
        {image}
      </View>
    );
  }
  if (item.frame === "stamp") {
    return (
      <View style={[styles.stamp, elevation]}>
        <StampEdge color={colors.surface} />
        {image}
      </View>
    );
  }
  return <View style={elevation}>{image}</View>;
}

/** A labelled region. Nothing is trapped inside it — it groups by position, so
 * dragging the section takes whatever is resting on it along. */
function SectionBody({
  item,
  editing,
  onText,
  onEditEnd,
}: {
  item: SectionItem;
  editing: boolean;
  onText: (text: string) => void;
  onEditEnd: () => void;
}) {
  const colors = usePalette();
  const tint = colors[item.color];
  return (
    <View
      style={[
        styles.section,
        { borderColor: alpha(tint, 0.5), backgroundColor: alpha(tint, 0.07) },
      ]}
    >
      <View style={[styles.sectionHead, { backgroundColor: alpha(tint, 0.22) }]}>
        <View style={[styles.sectionDot, { backgroundColor: tint }]} />
        <InlineInput
          value={item.label}
          editing={editing}
          placeholder="Section"
          onCommit={onText}
          onEditEnd={onEditEnd}
          singleLine
          style={[styles.sectionLabel, fontStyle("outfit", "600"), { color: colors.inkMuted }]}
        />
      </View>
    </View>
  );
}

/** A field that is only a field while it is being edited.
 *
 * Two problems it solves. First, an always-live `TextInput` swallows the touch
 * that should be starting a drag, so a note would be impossible to move. Until
 * `editing`, this is inert and the piece drags normally.
 *
 * Second, committing per keystroke would make the undo stack useless — one
 * step per letter. The draft is local and commits once, when the field is
 * done, so a typing session is a single undo. */
function InlineInput({
  value,
  editing,
  placeholder,
  onCommit,
  onEditEnd,
  singleLine,
  style,
}: {
  value: string;
  editing: boolean;
  placeholder: string;
  onCommit: (text: string) => void;
  onEditEnd: () => void;
  singleLine?: boolean;
  style: StyleProp<TextStyle>;
}) {
  const colors = usePalette();
  const [draft, setDraft] = useState(value);
  const opened = useRef(value);

  if (!editing) {
    return (
      <Text style={style} pointerEvents="none">
        {value || placeholder}
      </Text>
    );
  }
  return (
    <TextInput
      autoFocus
      value={draft}
      onChangeText={setDraft}
      onFocus={() => {
        opened.current = value;
        setDraft(value);
      }}
      onBlur={() => {
        if (draft !== opened.current) onCommit(draft);
        onEditEnd();
      }}
      multiline={!singleLine}
      scrollEnabled={false}
      placeholder={placeholder}
      placeholderTextColor={alpha(colors.inkMuted, 0.5)}
      style={[style, styles.input]}
    />
  );
}

function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

const styles = StyleSheet.create({
  note: {
    minHeight: 96,
    borderRadius: 3,
    padding: 12,
  },
  noteText: { fontSize: 13, lineHeight: 18 },
  input: { padding: 0, textAlignVertical: "top" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: DEFAULT_W.link,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  linkIcon: {
    height: 30,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  linkLines: { flex: 1, minWidth: 0 },
  linkLabel: { fontSize: 13 },
  linkHost: { fontSize: 11 },
  linkForm: {
    width: DEFAULT_W.link,
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  linkField: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  linkSave: { alignItems: "center", borderRadius: 999, paddingVertical: 7 },
  linkSaveText: { fontSize: 12 },
  polaroid: {
    padding: 8,
    paddingBottom: 26,
    borderRadius: 3,
  },
  stamp: { padding: 7 },
  section: {
    width: "100%",
    height: "100%",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: SECTION_RADIUS,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: SECTION_HEAD_H,
    paddingHorizontal: 10,
  },
  sectionDot: { height: 8, width: 8, borderRadius: 3 },
  sectionLabel: {
    flex: 1,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
