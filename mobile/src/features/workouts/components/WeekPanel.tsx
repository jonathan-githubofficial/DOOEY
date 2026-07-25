import { BookOpen } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { Eyebrow, Panel } from "@/components/surface";
import { fontStyle } from "@/features/style/tokens";
import { hapticTap } from "@/lib/haptics";
import { alpha } from "@/lib/theme";
import { usePalette, useType } from "@/stores/theme";
import { MUSCLE_SLUG } from "../anatomy";
import { useCardInk } from "../hues";
import type { RhythmDay } from "../rotation";
import { useWorkoutPrefs } from "../store";
import type { CardHue } from "../types";
import { WeekBody } from "./WeekBody";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

type Side = "front" | "back";

const other = (s: Side): Side => (s === "front" ? "back" : "front");

/** Which view shows more of this week's work. Ties — and an untrained week —
 * go to the front, the side people expect to see first. */
function busiestSide(painted: Map<string, CardHue>): Side {
  let front = 0;
  let back = 0;
  for (const target of painted.keys()) {
    const placed = MUSCLE_SLUG[target];
    if (placed?.side === "front") front++;
    else if (placed?.side === "back") back++;
  }
  return back > front ? "back" : "front";
}

/** The week at a glance: the body you've actually worked, which days you
 * trained, and — the part no list can tell you — what you've been skipping.
 * The way into the programs shelf sits in its top corner, where it's on screen
 * on every visit; the up-next hero steps aside mid-session, so it can't live
 * there. */
export function WeekPanel({
  rhythm,
  painted,
  rested,
  onBrowse,
}: {
  rhythm: RhythmDay[];
  painted: Map<string, CardHue>;
  rested: string[];
  onBrowse: () => void;
}) {
  const colors = usePalette();
  const type = useType();
  const ink = useCardInk();
  const gender = useWorkoutPrefs((s) => s.gender);
  // Open on the side the week actually happened on — a leg day lives on the
  // back, and a figure showing none of your work is worse than no figure.
  const [flipped, setFlipped] = useState(false);
  const busiest = busiestSide(painted);
  const side = flipped ? other(busiest) : busiest;

  const days = rhythm.filter((d) => d.hueKey).length;
  const shaded = new Map([...painted].map(([target, hue]) => [target, ink(hue).solid]));

  return (
    <Panel style={styles.panel}>
      <View style={styles.top}>
        <Pressable
          accessibilityLabel={`Show ${side === "front" ? "back" : "front"} of the body`}
          onPress={() => setFlipped(!flipped)}
          style={styles.figure}
        >
          <WeekBody painted={shaded} gender={gender} side={side} scale={0.42} />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.headRow}>
            <Eyebrow>this week</Eyebrow>
            {/* The shelf of proven splits, and where a program of your own
                starts too — one door, top corner, on every visit. */}
            <PressableScale
              scaleTo={0.96}
              accessibilityRole="button"
              accessibilityLabel="Browse programs"
              onPress={() => {
                hapticTap();
                onBrowse();
              }}
              style={[
                styles.browse,
                { backgroundColor: colors.surface, borderColor: alpha(colors.rule, 0.7) },
              ]}
            >
              <BookOpen size={14} color={colors.inkMuted} />
              <Text numberOfLines={1} style={[type.sansMedium, styles.browseText, { color: colors.ink }]}>
                Browse programs
              </Text>
            </PressableScale>
          </View>
          <Text style={[fontStyle("fraunces", "900"), styles.count, { color: colors.ink }]}>
            {days} {days === 1 ? "day" : "days"}
          </Text>

          <View style={styles.days}>
            {rhythm.map((d, i) => {
              const hit = d.hueKey ? ink(d.hueKey).solid : null;
              return (
                <View
                  key={d.date.toISOString()}
                  style={[
                    styles.key,
                    hit
                      ? { backgroundColor: hit }
                      : { borderWidth: 1.2, borderStyle: "dashed", borderColor: colors.rule },
                    d.isToday && !hit && { borderStyle: "solid", borderColor: colors.ink },
                  ]}
                >
                  <Text
                    style={[
                      type.sansSemiBold,
                      styles.keyText,
                      { color: hit ? colors.surface : d.isToday ? colors.ink : colors.inkMuted },
                    ]}
                  >
                    {LETTERS[i]}
                  </Text>
                </View>
              );
            })}
          </View>

          {rested.length > 0 && (
            <Text style={[type.sans, styles.rested, { color: colors.inkMuted }]}>
              Longest rested:{" "}
              <Text style={[type.sansSemiBold, { color: colors.ink }]}>{rested.join(" · ")}</Text>
            </Text>
          )}
        </View>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16 },
  top: { flexDirection: "row", gap: 16, alignItems: "center" },
  figure: { width: 66, alignItems: "center" },
  body: { flex: 1 },
  count: { fontSize: 27, letterSpacing: -0.9, marginTop: 1 },
  days: { flexDirection: "row", gap: 6, marginTop: 11 },
  key: {
    flex: 1,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 11, letterSpacing: 0.4 },
  rested: { fontSize: 11.5, marginTop: 11 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  // The app's plain control: a paper key on a rule hairline, the same recipe
  // the planner's view keys and the composer's chips wear.
  browse: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  browseText: { flexShrink: 1, fontSize: 12 },
});
