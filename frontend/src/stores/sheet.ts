import type { ReactNode } from "react";
import { create } from "zustand";

/** One choice in a menu. `icon` is what the app draws; `symbol` is the SF
 * Symbol the platform's own menu draws in its place, since UIKit won't take a
 * React element. */
export interface SheetAction {
  label: string;
  icon?: ReactNode;
  symbol?: string;
  destructive?: boolean;
  /** The one you are already on. A menu that switches between views has to say
   * which view you are in, or it is a list of guesses. */
  selected?: boolean;
  onPress: () => void;
}

/** Where on screen the ⋯ that opened the menu sits, in window coordinates.
 * The menu hangs off it rather than rising from the bottom of the screen. */
export interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActionsSheet {
  kind: "actions";
  /** What the choices are about: a routine's name, or the question a confirm asks. */
  title?: string;
  message?: string;
  anchor?: Anchor;
  actions: SheetAction[];
}

interface PromptSheet {
  kind: "prompt";
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
}

export type SheetSpec = ActionsSheet | PromptSheet;
export type Menu = Omit<ActionsSheet, "kind">;

interface SheetStore {
  spec: SheetSpec | null;
  /** Bumped on every open. The host keys its content on this, so a sheet that
   * replaces another one (a menu handing off to a confirm) remounts and fades
   * instead of swapping its words mid-air. */
  seq: number;
}

export const useSheetStore = create<SheetStore>(() => ({ spec: null, seq: 0 }));

const open = (spec: SheetSpec) => useSheetStore.setState((s) => ({ spec, seq: s.seq + 1 }));

/** Offer a few choices. Every ⋯ in the app comes through here and gets the same
 * answer on every platform: a small menu popping out of the button that was
 * pressed, right where the eye already is. */
export const openSheet = (menu: Menu) => open({ ...menu, kind: "actions" });

/** Ask for one line of text: name a program, rename a board. No OS has a
 * prompt worth borrowing, so this is always the app's own. */
export const openPrompt = (sheet: Omit<PromptSheet, "kind">) => open({ ...sheet, kind: "prompt" });

export const closeSheet = () => useSheetStore.setState({ spec: null });
