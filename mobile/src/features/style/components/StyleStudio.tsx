import Slider from "@react-native-community/slider";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { ImagePlus, Pencil, Plus, RotateCcw, X } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { DoodleEditor } from "@/components/DoodleEditor";
import { DoodleSvg } from "@/components/DoodleSvg";
import type { Stroke } from "@/lib/doodle";
import { Grain } from "@/components/grain";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel, Stamp, StampButton } from "@/components/surface";
import { alpha, type Palette } from "@/lib/theme";
import { usePalette, useThemeStore, useType } from "@/stores/theme";
import { BASE, useStyleStore } from "../store";
import {
  BACKDROPS,
  COLOR_TOKENS,
  DEFAULT_COLORS,
  FONT_CHOICES,
  DOODLE_PAGES,
  PRESETS,
  fontStyle,
  formatTriplet,
  parseTriplet,
  tripletToHsl,
  type ColorKey,
  type FontKey,
  type Mode,
} from "../tokens";

const settle = LinearTransition.springify().stiffness(400).damping(34);

/** The theme creator: recolour, refont and reshape the whole app, live —
 * the mobile counterpart of the web Style studio. (The photo backdrop stays
 * web-only for now.) */
export function StyleStudio() {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.stack}>
      <Text style={[styles.intro, type.sans, { color: colors.inkMuted }]}>
        Every change applies instantly to the whole app and is saved on this device.
      </Text>
      <PresetsPanel />
      <PalettePanel />
      <PageDoodlesPanel />
      <CompanionPanel />
      <TypePanel />
      <ShapePanel />
      <BackdropPanel />
      <SpecimenPanel />
    </View>
  );
}

/* ---------------------------------------------------------------- presets */

function PresetsPanel() {
  const colors = usePalette();
  const type = useType();
  const applyPreset = useStyleStore((s) => s.applyPreset);
  const resetAll = useStyleStore((s) => s.resetAll);
  return (
    <Panel style={styles.panel}>
      <Eyebrow>presets</Eyebrow>
      <View style={styles.presetRow}>
        {PRESETS.map((preset) => {
          const chips = (["paper", "surface", "zest"] as const).map((k) =>
            tripletToHsl(preset.colors.light[k] ?? DEFAULT_COLORS.light[k]),
          );
          return (
            <PressableScale
              key={preset.key}
              scaleTo={0.95}
              onPress={() => applyPreset(preset.key)}
              style={[
                styles.presetPill,
                { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
              ]}
            >
              <View style={styles.presetChips}>
                {chips.map((c, i) => (
                  <View
                    key={i}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: c,
                        borderColor: alpha(colors.rule, 0.7),
                        marginLeft: i === 0 ? 0 : -6,
                        zIndex: 3 - i,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.presetLabel, type.sansMedium, { color: colors.ink }]}>
                {preset.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.presetFooter}>
        <StampButton onPress={resetAll}>
          <RotateCcw size={14} color={colors.inkMuted} />
          <Text style={[styles.stampBtnText, type.sansMedium, { color: colors.inkMuted }]}>
            Factory reset
          </Text>
        </StampButton>
      </View>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
        Presets swap the palette; your fonts and shape settings stay put.
      </Text>
    </Panel>
  );
}

/* ---------------------------------------------------------------- palette */

function PalettePanel() {
  const colors = usePalette();
  const type = useType();
  const mode = useThemeStore((s) => s.theme);
  const setMode = useThemeStore((s) => s.set);
  const [editing, setEditing] = useState<ColorKey | null>(null);
  return (
    <Panel style={styles.panel}>
      <View style={styles.panelHead}>
        <Eyebrow>palette</Eyebrow>
        <View style={[styles.modeWell, { backgroundColor: alpha(colors.ink, 0.05) }]}>
          {(["light", "dark"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeBtn, mode === m && { backgroundColor: colors.surface }]}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  type.sansMedium,
                  { color: mode === m ? colors.ink : colors.inkMuted },
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
        You're editing the {mode} look — each mode keeps its own palette. Tap a swatch to mix
        the colour.
      </Text>
      <View style={styles.tokenList}>
        {COLOR_TOKENS.map((token, i) => (
          <ColorRow
            key={token.key}
            mode={mode}
            token={token}
            first={i === 0}
            open={editing === token.key}
            onToggle={() => setEditing((e) => (e === token.key ? null : token.key))}
          />
        ))}
      </View>
    </Panel>
  );
}

function ColorRow({
  mode,
  token,
  first,
  open,
  onToggle,
}: {
  mode: Mode;
  token: { key: ColorKey; label: string; hint: string };
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const override = useStyleStore((s) => s.colors[mode][token.key]);
  const setColor = useStyleStore((s) => s.setColor);
  const resetColor = useStyleStore((s) => s.resetColor);
  const value = override ?? DEFAULT_COLORS[mode][token.key];
  const { h, s, l } = parseTriplet(value);

  return (
    <Animated.View
      layout={settle}
      style={[!first && { borderTopWidth: 1, borderTopColor: alpha(colors.rule, 0.4) }]}
    >
      <View style={styles.tokenRow}>
        <PressableScale
          scaleTo={0.92}
          accessibilityLabel={`Mix the ${token.label.toLowerCase()} colour`}
          onPress={onToggle}
          style={[
            styles.swatch,
            {
              backgroundColor: tripletToHsl(value),
              borderColor: open ? colors.zest : colors.rule,
              borderWidth: open ? 2 : 1,
            },
          ]}
        />
        <View style={styles.tokenText}>
          <Text style={[styles.tokenLabel, type.sansMedium, { color: colors.ink }]}>
            {token.label}
          </Text>
          <Text style={[styles.tokenHint, type.sans, { color: colors.inkMuted }]}>
            {token.hint}
          </Text>
        </View>
        {override && (
          <Pressable
            accessibilityLabel={`Reset ${token.label}`}
            onPress={() => resetColor(mode, token.key)}
            hitSlop={8}
          >
            <RotateCcw size={14} color={colors.inkMuted} />
          </Pressable>
        )}
      </View>
      {open && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.mixer}>
          <MixSlider label="Hue" value={h} max={360} onChange={(v) => setColor(mode, token.key, formatTriplet(v, s, l))} />
          <MixSlider label="Saturation" value={s} max={100} onChange={(v) => setColor(mode, token.key, formatTriplet(h, v, l))} />
          <MixSlider label="Lightness" value={l} max={100} onChange={(v) => setColor(mode, token.key, formatTriplet(h, s, v))} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function MixSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View style={styles.mixRow}>
      <Text style={[styles.mixLabel, type.sans, { color: colors.inkMuted }]}>{label}</Text>
      <Slider
        style={styles.mixSlider}
        value={value}
        minimumValue={0}
        maximumValue={max}
        step={1}
        minimumTrackTintColor={colors.zest}
        maximumTrackTintColor={alpha(colors.ink, 0.15)}
        thumbTintColor={colors.zest}
        onValueChange={onChange}
      />
      <Text style={[styles.mixValue, type.sans, { color: colors.inkMuted }]}>{Math.round(value)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ page doodles */

/** Hand-drawn icons for the spaces: each page can wear a little doodle — next
 * to its title and as its icon in the dock — instead of a stock glyph. */
function PageDoodlesPanel() {
  const colors = usePalette();
  const type = useType();
  const pageDoodles = useStyleStore((s) => s.pageDoodles);
  const setPageDoodle = useStyleStore((s) => s.setPageDoodle);
  const dockDoodles = useStyleStore((s) => s.dockDoodles);
  const setDockDoodles = useStyleStore((s) => s.setDockDoodles);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <Panel style={styles.panel}>
      <View style={styles.panelHead}>
        <Eyebrow>page doodles</Eyebrow>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: dockDoodles }}
          accessibilityLabel="Use doodles as dock icons"
          onPress={() => setDockDoodles(!dockDoodles)}
          style={styles.dockSwitchRow}
        >
          <Text style={[styles.dockSwitchLabel, type.sans, { color: colors.inkMuted }]}>
            doodle icons in dock
          </Text>
          <View
            style={[
              styles.dockSwitch,
              { backgroundColor: dockDoodles ? alpha(colors.zest, 0.3) : alpha(colors.ink, 0.1) },
            ]}
          >
            <Animated.View
              layout={settle}
              style={[
                styles.dockKnob,
                { backgroundColor: colors.surface },
                dockDoodles && { alignSelf: "flex-end" },
              ]}
            />
          </View>
        </Pressable>
      </View>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
        Draw a little mark for each space — it appears next to the page title, and (when the
        switch is on) as its icon in the dock.
      </Text>
      <View style={styles.doodleGrid}>
        {DOODLE_PAGES.map((p) => {
          const strokes = pageDoodles[p.key] ?? [];
          return (
            <View key={p.key} style={styles.doodleCell}>
              <PressableScale
                scaleTo={0.95}
                accessibilityLabel={`Doodle the ${p.label} icon`}
                onPress={() => setEditing((e) => (e === p.key ? null : p.key))}
                style={[
                  styles.doodleTile,
                  {
                    backgroundColor: colors.paper,
                    borderColor: editing === p.key ? colors.zest : alpha(colors.rule, 0.7),
                  },
                ]}
              >
                <Grain radius={15} />
                {strokes.length ? (
                  <View style={styles.doodleArt}>
                    <DoodleSvg strokes={strokes} />
                  </View>
                ) : (
                  <Pencil size={16} color={alpha(colors.inkMuted, 0.5)} />
                )}
              </PressableScale>
              <Text style={[styles.doodleLabel, type.sansMedium, { color: colors.inkMuted }]}>
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>
      {editing && (
        <Animated.View key={editing} entering={FadeIn.duration(160)} style={styles.doodleEditor}>
          <DoodleEditor
            heading={`${editing} icon`}
            initial={pageDoodles[editing] ?? []}
            onClose={() => setEditing(null)}
            onSave={(strokes) => {
              setPageDoodle(editing, strokes);
              setEditing(null);
            }}
          />
        </Animated.View>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------- companion */

const MAX_POSES = 4;

/** The margin companion's animation desk: draw him once, then add poses —
 * each new pad ghosts the previous pose (onion skin) so the movement stays
 * on-model. Two or more poses and he flips alive on the planner. */
function CompanionPanel() {
  const colors = usePalette();
  const type = useType();
  const frames = useStyleStore((s) => s.companion);
  const setCompanion = useStyleStore((s) => s.setCompanion);
  // Editing an existing pose by index; frames.length means "a new pose".
  const [editing, setEditing] = useState<number | null>(null);

  const saveFrame = (index: number, strokes: Stroke[]) => {
    const next = [...frames];
    next[index] = strokes;
    setCompanion(next);
    setEditing(null);
  };
  const removeFrame = (index: number) => {
    setCompanion(frames.filter((_, i) => i !== index));
    setEditing(null);
  };

  return (
    <Panel style={styles.panel}>
      <Eyebrow>companion</Eyebrow>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
        A little creature for the planner's margin. Draw a pose, then add more — each pad shows
        the last pose as a ghost so the movement lines up. Two or more poses and he comes alive.
      </Text>
      <View style={styles.doodleGrid}>
        {frames.map((strokes, i) => (
          <View key={i} style={styles.doodleCell}>
            <PressableScale
              scaleTo={0.95}
              accessibilityLabel={`Edit pose ${i + 1}`}
              onPress={() => setEditing((e) => (e === i ? null : i))}
              style={[
                styles.doodleTile,
                {
                  backgroundColor: colors.paper,
                  borderColor: editing === i ? colors.zest : alpha(colors.rule, 0.7),
                },
              ]}
            >
              <Grain radius={15} />
              <View style={styles.doodleArt}>
                <DoodleSvg strokes={strokes} />
              </View>
              <Pressable
                accessibilityLabel={`Remove pose ${i + 1}`}
                hitSlop={6}
                onPress={() => removeFrame(i)}
                style={[styles.poseRemove, { backgroundColor: alpha(colors.paper, 0.9) }]}
              >
                <X size={10} color={colors.ink} />
              </Pressable>
            </PressableScale>
            <Text style={[styles.doodleLabel, type.sansMedium, { color: colors.inkMuted }]}>
              pose {i + 1}
            </Text>
          </View>
        ))}
        {frames.length < MAX_POSES && (
          <View style={styles.doodleCell}>
            <PressableScale
              scaleTo={0.95}
              accessibilityLabel="Add a pose"
              onPress={() => setEditing(frames.length)}
              style={[
                styles.doodleTile,
                styles.poseAdd,
                {
                  borderColor:
                    editing === frames.length ? colors.zest : alpha(colors.rule, 0.9),
                },
              ]}
            >
              {frames.length === 0 ? (
                <Pencil size={16} color={alpha(colors.inkMuted, 0.5)} />
              ) : (
                <Plus size={16} color={alpha(colors.inkMuted, 0.5)} />
              )}
            </PressableScale>
            <Text style={[styles.doodleLabel, type.sansMedium, { color: colors.inkMuted }]}>
              {frames.length === 0 ? "draw him" : "add pose"}
            </Text>
          </View>
        )}
      </View>
      {editing != null && (
        <Animated.View key={editing} entering={FadeIn.duration(160)} style={styles.doodleEditor}>
          <DoodleEditor
            heading={`pose ${editing + 1}`}
            initial={frames[editing] ?? []}
            // The onion skin: the pose before this one, ghosted underneath.
            underlay={editing > 0 ? frames[editing - 1] : undefined}
            onClose={() => setEditing(null)}
            onSave={(strokes) => saveFrame(editing, strokes)}
          />
        </Animated.View>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------- type */

function TypePanel() {
  const fontDisplay = useStyleStore((s) => s.fontDisplay);
  const fontSans = useStyleStore((s) => s.fontSans);
  const setFont = useStyleStore((s) => s.setFont);
  return (
    <Panel style={styles.panel}>
      <Eyebrow>type</Eyebrow>
      <View style={styles.typeStack}>
        <FontPicker
          label="Display — titles & big numbers"
          active={fontDisplay}
          onPick={(f) => setFont("display", f)}
        />
        <FontPicker
          label="Body — everything else"
          active={fontSans}
          onPick={(f) => setFont("sans", f)}
        />
      </View>
    </Panel>
  );
}

function FontPicker({
  label,
  active,
  onPick,
}: {
  label: string;
  active: FontKey;
  onPick: (f: FontKey) => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>{label}</Text>
      <View style={styles.fontRow}>
        {FONT_CHOICES.map((font) => {
          const isActive = active === font.key;
          return (
            <PressableScale
              key={font.key}
              scaleTo={0.95}
              onPress={() => onPick(font.key)}
              style={[
                styles.fontPill,
                isActive
                  ? { borderColor: colors.zest, backgroundColor: alpha(colors.zest, 0.1) }
                  : { borderColor: colors.rule },
              ]}
            >
              <Text
                style={[
                  styles.fontPillText,
                  fontStyle(font.key, isActive ? "600" : "400"),
                  { color: isActive ? colors.ink : colors.inkMuted },
                ]}
              >
                {font.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ shape */

function ShapePanel() {
  const colors = usePalette();
  const type = useType();
  const radius = useStyleStore((s) => s.radius);
  const grain = useStyleStore((s) => s.grain);
  const shadow = useStyleStore((s) => s.shadow);
  const setShape = useStyleStore((s) => s.setShape);
  const sounds = useStyleStore((s) => s.sounds);
  const setSounds = useStyleStore((s) => s.setSounds);
  return (
    <Panel style={styles.panel}>
      <View style={styles.panelHead}>
        <Eyebrow>shape & feel</Eyebrow>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: sounds }}
          accessibilityLabel="Paper sounds — page flips and pencil scratches"
          onPress={() => setSounds(!sounds)}
          style={styles.dockSwitchRow}
        >
          <Text style={[styles.dockSwitchLabel, type.sans, { color: colors.inkMuted }]}>
            paper sounds
          </Text>
          <View
            style={[
              styles.dockSwitch,
              { backgroundColor: sounds ? alpha(colors.zest, 0.3) : alpha(colors.ink, 0.1) },
            ]}
          >
            <Animated.View
              layout={settle}
              style={[
                styles.dockKnob,
                { backgroundColor: colors.surface },
                sounds && { alignSelf: "flex-end" },
              ]}
            />
          </View>
        </Pressable>
      </View>
      <View style={styles.shapeStack}>
        <SliderRow
          label="Corners"
          display={`${Math.round(radius * 16)}px`}
          value={radius}
          max={3}
          step={0.125}
          isDefault={radius === BASE.radius}
          onChange={(v) => setShape({ radius: v })}
          onReset={() => setShape({ radius: BASE.radius })}
        />
        <SliderRow
          label="Paper grain"
          display={`${Math.round(grain * 100)}%`}
          value={grain}
          max={2}
          step={0.1}
          isDefault={grain === BASE.grain}
          onChange={(v) => setShape({ grain: v })}
          onReset={() => setShape({ grain: BASE.grain })}
        />
        <SliderRow
          label="Shadows"
          display={`${Math.round(shadow * 100)}%`}
          value={shadow}
          max={2}
          step={0.1}
          isDefault={shadow === BASE.shadow}
          onChange={(v) => setShape({ shadow: v })}
          onReset={() => setShape({ shadow: BASE.shadow })}
        />
      </View>
    </Panel>
  );
}

function SliderRow({
  label,
  display,
  value,
  max,
  step,
  isDefault,
  onChange,
  onReset,
}: {
  label: string;
  display: string;
  value: number;
  max: number;
  step: number;
  isDefault: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  return (
    <View>
      <View style={styles.sliderHead}>
        <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>{label}</Text>
        <View style={styles.sliderValue}>
          <Text style={[styles.sliderValueText, type.sans, { color: colors.inkMuted }]}>
            {display}
          </Text>
          {!isDefault && (
            <Pressable accessibilityLabel={`Reset ${label}`} onPress={onReset} hitSlop={8}>
              <RotateCcw size={12} color={colors.inkMuted} />
            </Pressable>
          )}
        </View>
      </View>
      <Slider
        style={styles.slider}
        value={value}
        minimumValue={0}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={colors.zest}
        maximumTrackTintColor={alpha(colors.ink, 0.15)}
        thumbTintColor={colors.zest}
        onValueChange={onChange}
      />
    </View>
  );
}

/* --------------------------------------------------------------- backdrop */

/** A quiet colour wash over the paper — always through the palette, always
 * faint, so the app keeps its paper feel. */
function BackdropPanel() {
  const colors = usePalette();
  const type = useType();
  const backdrop = useStyleStore((s) => s.backdrop);
  const setBackdrop = useStyleStore((s) => s.setBackdrop);
  const image = useStyleStore((s) => s.backdropImage);
  const setImage = useStyleStore((s) => s.setBackdropImage);
  const blur = useStyleStore((s) => s.backdropBlur);
  const opacity = useStyleStore((s) => s.backdropOpacity);
  const setEffect = useStyleStore((s) => s.setBackdropEffect);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    // The picker's uri lives in a cache that gets swept — keep our own copy.
    try {
      const to = `${FileSystem.documentDirectory}backdrop-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: asset.uri, to });
      setImage(to);
    } catch {
      setImage(asset.uri); // web has no document directory — use it in place
    }
  };

  return (
    <Panel style={styles.panel}>
      <Eyebrow>backdrop</Eyebrow>
      <Text style={[styles.hint, type.sans, { color: colors.inkMuted }]}>
        A breath of colour over the paper. It follows your palette, so presets and dark mode
        re-ink it.
      </Text>
      <View style={styles.backdropRow}>
        <PressableScale
          scaleTo={0.95}
          accessibilityState={{ selected: backdrop == null }}
          onPress={() => setBackdrop(null)}
          style={[
            styles.backdropPill,
            {
              backgroundColor: colors.paper,
              borderColor: backdrop == null ? colors.zest : alpha(colors.rule, 0.7),
              borderWidth: backdrop == null ? 1.5 : 1,
            },
          ]}
        >
          <Text style={[styles.backdropLabel, type.sansMedium, { color: colors.inkMuted }]}>
            plain
          </Text>
        </PressableScale>
        {BACKDROPS.map((b) => {
          const active = backdrop === b.key;
          return (
            <PressableScale
              key={b.key}
              scaleTo={0.95}
              accessibilityState={{ selected: active }}
              onPress={() => setBackdrop(active ? null : b.key)}
              style={[
                styles.backdropPill,
                {
                  borderColor: active ? colors.zest : alpha(colors.rule, 0.7),
                  borderWidth: active ? 1.5 : 1,
                },
              ]}
            >
              <LinearGradient
                pointerEvents="none"
                colors={[
                  alpha(colors[b.from as keyof Palette], 0.35),
                  colors.paper,
                  alpha(colors[b.to as keyof Palette], 0.3),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.backdropLabel, type.sansMedium, { color: colors.ink }]}>
                {b.label}
              </Text>
            </PressableScale>
          );
        })}
        {/* Your own photo — softened until it belongs to the paper. */}
        {image ? (
          <View
            style={[styles.backdropPill, styles.photoPill, { borderColor: alpha(colors.rule, 0.7) }]}
          >
            <Image source={{ uri: image }} blurRadius={4} style={StyleSheet.absoluteFill} />
            <Pressable
              accessibilityLabel="Remove the photo backdrop"
              hitSlop={8}
              onPress={() => setImage(null)}
              style={[styles.photoRemove, { backgroundColor: alpha(colors.paper, 0.85) }]}
            >
              <X size={12} color={colors.ink} />
            </Pressable>
          </View>
        ) : (
          <PressableScale
            scaleTo={0.95}
            accessibilityLabel="Use a photo as the backdrop"
            onPress={pickPhoto}
            style={[styles.backdropPill, styles.photoAdd, { borderColor: alpha(colors.rule, 0.9) }]}
          >
            <ImagePlus size={16} color={alpha(colors.inkMuted, 0.7)} />
            <Text style={[styles.backdropLabel, type.sansMedium, { color: colors.inkMuted }]}>
              photo
            </Text>
          </PressableScale>
        )}
      </View>

      {image && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.photoTuners}>
          <SliderRow
            label="Soften"
            display={`${Math.round(blur)}px`}
            value={blur}
            max={30}
            step={1}
            isDefault={blur === 12}
            onChange={(v) => setEffect({ backdropBlur: v })}
            onReset={() => setEffect({ backdropBlur: 12 })}
          />
          <SliderRow
            label="Presence"
            display={`${Math.round(opacity * 100)}%`}
            value={opacity}
            max={0.5}
            step={0.05}
            isDefault={opacity === 0.2}
            onChange={(v) => setEffect({ backdropOpacity: v })}
            onReset={() => setEffect({ backdropOpacity: 0.2 })}
          />
        </Animated.View>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------- specimen */

function SpecimenPanel() {
  const colors = usePalette();
  const type = useType();
  return (
    <Panel style={styles.panel}>
      <Eyebrow>specimen</Eyebrow>
      <Text style={[styles.specimenTitle, type.display, { color: colors.ink }]}>
        Sphinx of quartz, judge my vow.
      </Text>
      <Text style={[styles.specimenBody, type.sans, { color: colors.inkMuted }]}>
        Body text sits like this — lists, notes, and the quiet parts of the day. The dot on the
        wordmark, progress washes and highlights all take the accent.
      </Text>
      <View style={styles.specimenRow}>
        <StampButton onPress={() => {}}>
          <Text style={[styles.stampBtnText, type.sansMedium, { color: colors.ink }]}>stamp</Text>
        </StampButton>
        <Stamp color={colors.leaf}>done</Stamp>
        <View style={styles.specimenDots}>
          {([colors.leaf, colors.zest, colors.sky, colors.clay, colors.honey] as const).map(
            (c, i) => (
              <View key={i} style={[styles.specimenDot, { backgroundColor: c }]} />
            ),
          )}
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  intro: { fontSize: 13, lineHeight: 19 },
  panel: { padding: 24 },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  hint: { marginTop: 8, fontSize: 12, lineHeight: 17 },

  presetRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  presetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
  },
  presetChips: { flexDirection: "row" },
  presetChip: { height: 20, width: 20, borderRadius: 999, borderWidth: 1 },
  presetLabel: { fontSize: 13 },
  presetFooter: { marginTop: 12, flexDirection: "row" },
  stampBtnText: { fontSize: 13 },

  modeWell: { flexDirection: "row", borderRadius: 999, padding: 4 },
  modeBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4 },
  modeBtnText: { fontSize: 12, textTransform: "capitalize" },
  tokenList: { marginTop: 8 },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  swatch: { height: 36, width: 36, borderRadius: 999 },
  tokenText: { flex: 1, minWidth: 0 },
  tokenLabel: { fontSize: 14 },
  tokenHint: { fontSize: 12, marginTop: 1 },
  mixer: { paddingBottom: 12, gap: 2 },
  mixRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mixLabel: { width: 72, fontSize: 12 },
  mixSlider: { flex: 1, height: 32 },
  mixValue: { width: 32, fontSize: 12, textAlign: "right", fontVariant: ["tabular-nums"] },

  dockSwitchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dockSwitchLabel: { fontSize: 11 },
  dockSwitch: { height: 20, width: 36, borderRadius: 999, padding: 2, justifyContent: "center" },
  dockKnob: { height: 16, width: 16, borderRadius: 999 },
  doodleGrid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 16 },
  doodleCell: { alignItems: "center", gap: 6 },
  doodleTile: {
    height: 64,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
  },
  doodleArt: { height: 48, width: 48 },
  doodleLabel: { fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase" },
  doodleEditor: { marginTop: 12, alignItems: "center" },
  poseAdd: { borderStyle: "dashed" },
  poseRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    height: 16,
    width: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },

  typeStack: { marginTop: 8, gap: 20 },
  fontRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fontPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  fontPillText: { fontSize: 14 },

  shapeStack: { marginTop: 12, gap: 16 },

  backdropRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoPill: { padding: 0 },
  photoAdd: { flexDirection: "row", gap: 6, borderStyle: "dashed" },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    height: 20,
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  photoTuners: { marginTop: 12, gap: 12 },
  backdropPill: {
    height: 44,
    minWidth: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    overflow: "hidden",
    paddingHorizontal: 12,
  },
  backdropLabel: { fontSize: 12 },
  sliderHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sliderValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  sliderValueText: { fontSize: 12, fontVariant: ["tabular-nums"] },
  slider: { marginTop: 4, width: "100%", height: 32 },

  specimenTitle: { marginTop: 8, fontSize: 26, letterSpacing: -0.5 },
  specimenBody: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  specimenRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  specimenDots: { flexDirection: "row", gap: 6 },
  specimenDot: { height: 16, width: 16, borderRadius: 999 },
});
