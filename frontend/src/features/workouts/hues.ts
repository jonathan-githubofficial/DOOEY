import { useCallback } from "react";
import { relight } from "@/lib/theme";
import { usePalette, useThemeStore } from "@/stores/theme";
import type { CardHue } from "./types";

/** The four shades a card draws from one accent. Every one is derived from the
 * live palette token, so retuning `clay` in the Style studio repaints every
 * clay card, in both themes. */
export interface CardInk {
  /** The card's colour field. */
  field: string;
  /** The watermark doodle — visible, never competing with the title. */
  mark: string;
  /** Stamps and tags: the accent at reading contrast against `field`. */
  stamp: string;
  /** The accent itself, undimmed. */
  solid: string;
}

/** Light fields are pale washes carrying dark ink; dark fields invert — a deep
 * wash carrying light ink. Same hue either way. */
const LIGHT = { field: [46, 91], mark: [44, 66], stamp: [52, 34] } as const;
const DARK = { field: [24, 18], mark: [34, 38], stamp: [55, 70] } as const;

export function useCardInk(): (hue: CardHue) => CardInk {
  const colors = usePalette();
  const dark = useThemeStore((s) => s.theme) === "dark";

  return useCallback(
    (hue: CardHue) => {
      const token = colors[hue];
      const s = dark ? DARK : LIGHT;
      return {
        field: relight(token, s.field[0], s.field[1]),
        mark: relight(token, s.mark[0], s.mark[1]),
        stamp: relight(token, s.stamp[0], s.stamp[1]),
        solid: token,
      };
    },
    [colors, dark],
  );
}
