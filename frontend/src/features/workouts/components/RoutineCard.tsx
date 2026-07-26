import type { Menu } from "@/stores/sheet";
import { cardAir, leanOf } from "../card-metrics";
import { focusOf, hueOf } from "../focus";
import { useCardInk } from "../hues";
import type { Routine } from "../types";
import { useEmblem } from "../emblem";
import { CardFace, CardMenu, CardShell } from "./card-parts";
import { MuscleTwin } from "./MuscleTwin";

/** A routine on the board: its colour, its drawing, the body it works, and its
 * name. The figures sit in the headroom above the title, where the ⋯ and the
 * watermark both leave the card free. */
export function RoutineCard({
  routine,
  index,
  onOpen,
  menu,
}: {
  routine: Routine;
  index: number;
  onOpen: () => void;
  menu: () => Menu;
}) {
  const count = routine.items.length;
  const hue = hueOf(routine);
  const ink = useCardInk()(hue);
  const emblem = useEmblem(routine.emblem);
  const focus = focusOf(routine.items);

  return (
    <CardShell
      hue={hue}
      emblem={emblem}
      lean={leanOf(index)}
      accessibilityLabel={`Open ${routine.name}`}
      onPress={onOpen}
    >
      <CardMenu label={`${routine.name} options`} menu={menu} />
      <MuscleTwin targets={focus?.targets ?? []} tint={ink.stamp} />
      <CardFace
        hue={hue}
        air={cardAir(count)}
        title={routine.name}
        meta={count === 0 ? "empty — tap to build" : `${count} ${count === 1 ? "exercise" : "exercises"}`}
        tag={focus?.label ?? null}
      />
    </CardShell>
  );
}
