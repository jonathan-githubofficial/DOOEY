import io

p = 'src/features/tasks/components/TaskComposer.tsx'
s = io.open(p, encoding='utf-8').read()


def sub(a, b, n=1):
    global s
    assert s.count(a) == n, (s.count(a), a[:70])
    s = s.replace(a, b)


# ── state: the tag field is opened from the icon row, like a chip ──────────
sub(
    '  const [tags, setTags] = useState<string[]>([]);',
    '  const [tags, setTags] = useState<string[]>([]);\n  const [showTags, setShowTags] = useState(false);',
)

# ── the icon row, and the tag field it opens ───────────────────────────────
sub(
    '''          <ChevronRight size={13} color={alpha(colors.inkMuted, 0.6)} />
        </PressableScale>
      </View>

      {/* The last row of the form: tags take the width, the tick takes the
          corner. Inline rather than floating — a disc pinned over the sheet
          would sit on top of the tag suggestions as they scroll under it. */}
      <View style={styles.bottomRow}>
        <View style={styles.bottomFill}>
          <TagField tags={tags} onChange={setTags} />
        </View>
        {/* No matching cancel: the sheet's own grabber and scrim already
            dismiss it, and a ✕ would be a third way to do the same thing. */}
        <PressableScale
          scaleTo={0.9}
          accessibilityLabel="Add task"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          onPress={submit}
          style={[styles.addDisc, { backgroundColor: colors.zest }, !ready && styles.addDiscOff]}
        >
          <Check size={20} color={colors.paper} strokeWidth={3} />
        </PressableScale>
      </View>
    </View>
  );
}''',
    '''          <ChevronRight size={13} color={alpha(colors.inkMuted, 0.6)} />
        </PressableScale>
        {/* Beside the calendar, and the start of a row meant to grow: one
            square per thing a task can carry, each opening its own field
            below. */}
        <IconChip
          Icon={Tag}
          label="Tags"
          tint={colors.sky}
          active={tagsOpen}
          onPress={() => {
            hapticTap();
            setShowTags((v) => !v);
          }}
        />
      </View>

      {tagsOpen && (
        <Animated.View entering={FadeIn.duration(dur.quick)} style={styles.tagRow}>
          <TagField tags={tags} onChange={setTags} />
        </Animated.View>
      )}

      {/* Pushes the button to the sheet's bottom edge. The sheet is already
          sized to sit above the keyboard when one is up, so "bottom of the
          sheet" is "above the keyboard" while typing and the true bottom once
          it's dismissed — the button rides along without knowing about either. */}
      {fill && <View style={styles.fill} />}

      {/* Nothing to add until there is something to add: the button is absent
          rather than greyed, so the form is only ever as busy as it needs to
          be. No matching cancel — the sheet's grabber and scrim already
          dismiss it, and a ✕ would be a third way to do the same thing. */}
      {!!title.trim() && (
        <Animated.View
          entering={appear()}
          exiting={FadeOut.duration(dur.instant)}
          style={styles.submitRow}
        >
          <PressableScale
            scaleTo={0.9}
            accessibilityLabel="Add task"
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={submit}
            style={[styles.addDisc, { backgroundColor: colors.zest }, !ready && styles.addDiscOff]}
          >
            <ArrowUp size={22} color={colors.paper} strokeWidth={2.6} />
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

/** One square in the composer's icon row. A tick means "commit"; these mean
 * "this task also has one of these", so they light rather than confirm. */
function IconChip({
  Icon,
  label,
  tint,
  active,
  onPress,
}: {
  Icon: typeof Tag;
  label: string;
  tint: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = usePalette();
  return (
    <PressableScale
      scaleTo={0.9}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.iconChip,
        active
          ? { borderColor: alpha(tint, 0.5), backgroundColor: alpha(tint, 0.12) }
          : { borderColor: colors.rule },
      ]}
    >
      <Icon size={15} color={active ? tint : colors.inkMuted} />
    </PressableScale>
  );
}''',
)

# The field stays open while it holds anything, however it was opened.
sub(
    '  const ready = !!title.trim() && !create.isPending;',
    '  const ready = !!title.trim() && !create.isPending;\n  // Once a tag is on, the field stays put — closing it would hide the tags.\n  const tagsOpen = showTags || tags.length > 0;',
)

# ── styles ────────────────────────────────────────────────────────────────
sub(
    '''  bottomRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  bottomFill: { flex: 1, minWidth: 0 },
  addDisc: {''',
    '''  iconChip: {
    height: 34,
    width: 34,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tagRow: { marginTop: 10 },
  submitRow: { marginTop: 12, alignItems: "flex-end" },
  addDisc: {''',
)

# ── imports ───────────────────────────────────────────────────────────────
sub(
    '''import {
  CalendarArrowUp,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Moon,
  Plus,
  Repeat,
  Sunrise,
} from "lucide-react-native";''',
    '''import {
  ArrowUp,
  CalendarArrowUp,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock,
  Moon,
  Plus,
  Repeat,
  Sunrise,
  Tag,
} from "lucide-react-native";''',
)
sub('import { dur } from "@/lib/motion";', 'import { appear, dur } from "@/lib/motion";')

io.open(p, 'w', encoding='utf-8').write(s)
print('ok')
