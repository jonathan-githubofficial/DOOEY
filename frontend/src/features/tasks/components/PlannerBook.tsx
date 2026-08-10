import { LinearGradient } from "expo-linear-gradient";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { useCardRadius, useShadow } from "@/features/style/store";
import { playFlip } from "@/lib/sounds";
import { alpha } from "@/lib/theme";
import { usePalette, useThemeStore } from "@/stores/theme";

/** Binding geometry — rings and the sheet's punched holes must agree, so both
 * layers use these: same slot count, same gutter. */
export const RING_COUNT = 3;
export const BINDING_INSET = "16%";

/** How long the forward peel takes. */
const PEEL_MS = 340;

const SHOT = { format: "png", result: "tmpfile" } as const;

/** A day change in flight.
 *
 * `prep` is the part nobody sees: the incoming day mounting, the page being
 * photographed. `turn` is the only part that moves. Keeping them as phases is
 * the whole trick — the expensive work and the animation never share a frame.
 */
interface Flip {
  from: string;
  to: string;
  dir: number;
  phase: "prep" | "turn";
  /** The photograph the turning sheet shows. Null on the web, which turns the
   * live page instead. */
  shot: string | null;
}

/** The top-bound planner pad: static wire rings, pages that flip up over the
 * binding, desk-calendar style, and the rest of the pad peeking out below.
 *
 * Forward, the day you were reading peels up over the rings and the next day
 * is revealed already sitting beneath it. Back, the previous day swings down
 * from over the top and lands on the pad.
 *
 * **The page that turns is a photograph.** Three attempts at rotating the live
 * page established that iOS will not do it smoothly however little of it
 * re-renders: a full sheet of text, grain and gradients has to be rasterized
 * to be rotated in 3D, and that cost lands mid-animation, sometimes per frame.
 * A `captureRef` bitmap is pixel-identical to the page it stands in for and
 * rotates for free. So each flip is: photograph, then move the photograph,
 * while the real pages hold still —
 *
 * - Forward: photograph the page on screen, swap the day underneath it in the
 *   same commit the photo appears at 0° (covering, so the swap is invisible),
 *   then peel the photo up and away.
 * - Back: mount the incoming day at opacity 0, give it two frames to settle,
 *   photograph it, swing the photo down from over the top, and swap the real
 *   page in at the moment it lands — under pixels that match exactly.
 *
 * The web keeps turning the live page: browsers are built for CSS 3D and
 * view-shot is not built for browsers. And if a photograph cannot be taken,
 * the day simply swaps instantly, which is never wrong. */
export function PlannerBook({
  page,
  direction,
  renderPage,
}: {
  page: string;
  direction: number;
  /** Must be referentially stable (useCallback in the caller): the pages are
   * memoised on this function's identity, and an inline arrow here re-mounts
   * both days on every flip — the jank this component exists to avoid. */
  renderPage: (page: string) => ReactNode;
}) {
  const colors = usePalette();
  const radius = useCardRadius();

  // The day in the flow. During a flip the visible day is derived instead:
  // forward shows the new day the moment the photo covers it, back keeps the
  // old day until the photo lands.
  const [base, setBase] = useState(page);
  const [flip, setFlip] = useState<Flip | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const baseRef = useRef<View>(null);
  const hiddenRef = useRef<View>(null);

  // Render-time adjust: a changed `page` starts (or redirects) a flip.
  const target = flip ? flip.to : base;
  if (page !== target) {
    if (Platform.OS !== "web" && size.h === 0) {
      // Nothing has laid out yet, so there is nothing to photograph.
      setBase(page);
      if (flip) setFlip(null);
    } else {
      // Whatever the reader can see right now is the day this turn starts
      // from — a redirected mid-flight flip included.
      const from =
        flip && flip.phase === "turn" && flip.dir > 0 ? flip.to : flip ? flip.from : base;
      if (flip && from !== base) setBase(from);
      setFlip({
        from,
        to: page,
        dir: direction,
        // The web has no photograph to wait for.
        phase: Platform.OS === "web" ? "turn" : "prep",
        shot: null,
      });
    }
  }

  const turning = flip?.phase === "turn";
  // Forward swaps the day under the photo at turn start; back holds the old
  // day until the photo has landed on it.
  const baseDay = flip ? (flip.phase === "turn" && flip.dir > 0 ? flip.to : flip.from) : base;
  // Only mounted while a back flip is being photographed.
  const hiddenDay = flip && flip.phase === "prep" && flip.dir < 0 ? flip.to : null;
  // The web's live turning page; native shows the photograph instead.
  const topDay =
    flip && flip.phase === "turn" && Platform.OS === "web"
      ? flip.dir > 0
        ? flip.from
        : flip.to
      : null;

  // Memoised by day so starting a flip re-renders nothing that is already on
  // screen. Load-bearing: see the note on `renderPage`.
  const elBase = useMemo(() => renderPage(baseDay), [baseDay, renderPage]);
  const elHidden = useMemo(
    () => (hiddenDay ? renderPage(hiddenDay) : null),
    [hiddenDay, renderPage],
  );
  const elTop = useMemo(() => (topDay ? renderPage(topDay) : null), [topDay, renderPage]);

  // Prep: photograph the right page, then advance to the turn. Two frames
  // first, so a freshly mounted day has painted (and its titles have reported
  // their line counts) before it sits for its portrait.
  useEffect(() => {
    if (!flip || flip.phase !== "prep") return;
    let live = true;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        captureRef(flip.dir > 0 ? baseRef : hiddenRef, SHOT).then(
          (uri) => {
            if (!live) return;
            setFlip((f) => (f && f.phase === "prep" ? { ...f, phase: "turn", shot: uri } : f));
          },
          () => {
            // No photograph, no theatre: just be on the day that was asked for.
            if (!live) return;
            setBase(flip.to);
            setFlip(null);
          },
        );
      });
    });
    return () => {
      live = false;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [flip]);

  const progress = useSharedValue(1);
  const dirSv = useSharedValue(1);

  // Turn: layout effect, not effect — the pose has to be set before this
  // commit paints, or the first frame shows the sheet in last flip's end pose
  // (rotated away, faded) and the day beneath it swapped: a one-frame jump cut
  // in front of every single flip.
  useLayoutEffect(() => {
    if (!flip || flip.phase !== "turn") return;
    playFlip();
    dirSv.value = flip.dir;
    progress.value = 0;
    const finish = () => {
      if (flip.shot) releaseCapture(flip.shot);
      setBase(flip.to);
      setFlip(null);
    };
    // A flip that starts while another runs replaces it on the same shared
    // value; the superseded callback arrives with `done: false` and changes
    // nothing.
    progress.value =
      flip.dir > 0
        ? withTiming(
            1,
            { duration: PEEL_MS, easing: Easing.bezier(0.5, 0.05, 0.75, 0.55) },
            (done) => {
              if (done) runOnJS(finish)();
            },
          )
        : // Damping 26: the house rule is a ratio of 0.8 or better, and a
          // page that overshoots past flat has gone through the pad.
          withSpring(1, { stiffness: 260, damping: 26, mass: 0.9 }, (done) => {
            if (done) runOnJS(finish)();
          });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flip]);

  // The turning sheet: forward → peels 0→140° UP over the rings (positive
  // rotateX, origin top), fading only over the last stretch of the lift;
  // back → swings 140→0° down from over the top.
  const topStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const forward = dirSv.value > 0;
    const deg = forward ? 140 * p : 140 * (1 - p);
    return {
      opacity: forward && p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1,
      transform: [{ perspective: 1400 }, { rotateX: `${deg}deg` }],
    };
  });
  // The page in the flow beneath it: rising out of the pad's shadow as it is
  // uncovered (forward), or dimming as the landing sheet covers it (back).
  const underStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return dirSv.value > 0
      ? { opacity: 0.9 + 0.1 * p, transform: [{ scale: 0.988 + 0.012 * p }] }
      : { opacity: 1 - 0.25 * p, transform: [{ scale: 1 - 0.012 * p }] };
  });

  return (
    <View style={styles.book}>
      <Rings />
      <Animated.View style={[styles.page, turning ? underStyle : null]}>
        {/* Inner plain View: the capture target, free of animated styles, so a
            photograph is always of the page at rest. */}
        <View
          ref={baseRef}
          collapsable={false}
          onLayout={(e) =>
            setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
        >
          {elBase}
        </View>
      </Animated.View>

      {/* The incoming day of a back flip, sitting for its portrait. */}
      {elHidden && (
        <View
          ref={hiddenRef}
          collapsable={false}
          pointerEvents="none"
          style={[styles.hidden, { height: size.h }]}
        >
          {elHidden}
        </View>
      )}

      {turning && (flip.shot || elTop) && (
        <Animated.View
          pointerEvents="none"
          style={[styles.topPage, flip.shot ? { height: size.h } : null, topStyle]}
        >
          {flip.shot ? (
            <Image
              source={{ uri: flip.shot }}
              fadeDuration={0}
              resizeMode="stretch"
              style={styles.shotImg}
            />
          ) : (
            elTop
          )}
        </Animated.View>
      )}

      {/* The pad edges ride the page's bottom. No `layout` on any of this: a
          transition tweening these boxes while the sheet turns above them is
          two animations arguing over the same pixels. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.padEdge,
          {
            marginTop: -11,
            marginHorizontal: 8,
            zIndex: -1,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            backgroundColor: alpha(colors.surface, 0.9),
            borderColor: alpha(colors.rule, 0.6),
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.padEdge,
          {
            marginTop: -11,
            marginHorizontal: 20,
            zIndex: -2,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            backgroundColor: alpha(colors.surface, 0.7),
            borderColor: alpha(colors.rule, 0.5),
          },
        ]}
      />
    </View>
  );
}

/** The binder wire: three slim metal loops that dive into the page's punched
 * holes. They belong to the binder, so they sit above every flipping page. */
function Rings() {
  const colors = usePalette();
  const shadow = useShadow();
  const dark = useThemeStore((s) => s.theme) === "dark";
  return (
    <View pointerEvents="none" style={styles.bindingRow}>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <View key={i} style={styles.bindingSlot}>
          {/* Shadow on a wrapper: the web's 0 1px 2px drop under each wire —
              the gradient view itself would clip it. */}
          <View
            style={[
              styles.ringShadow,
              {
                shadowColor: colors.ink,
                shadowOpacity: 0.3 * shadow,
                elevation: Math.round(2 * shadow),
              },
            ]}
          >
            {/* Physical light on the metal wire, not palette: a specular
                highlight stays white in every theme, like the plate's sheen. */}
            <LinearGradient
              colors={
                dark
                  ? ["rgba(255,255,255,0.4)", "rgba(255,255,255,0.1)", "rgba(0,0,0,0.4)"]
                  : ["#ffffff", alpha(colors.ink, 0.05), alpha(colors.ink, 0.3)]
              }
              style={[
                styles.ring,
                { borderColor: dark ? "rgba(255,255,255,0.3)" : alpha(colors.ink, 0.4) },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  book: {
    marginTop: 20, // room for the rings arcing over the top edge
  },
  page: {
    zIndex: 1,
    transformOrigin: "top",
  },
  topPage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 5,
    transformOrigin: "top",
  },
  hidden: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: 0,
  },
  shotImg: {
    width: "100%",
    height: "100%",
  },
  padEdge: {
    height: 16,
    borderWidth: 1,
  },
  bindingRow: {
    position: "absolute",
    left: BINDING_INSET,
    right: BINDING_INSET,
    top: -20,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bindingSlot: {
    width: 12,
    alignItems: "center",
  },
  ringShadow: {
    borderRadius: 999,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  ring: {
    height: 36,
    width: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
});
