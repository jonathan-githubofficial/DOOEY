/** Pure list arithmetic for the two arrangeable surfaces — the dock and the
 * Home widget stack. Zero imports on purpose: this file is unit-tested and
 * everything shape-shifting about the shell funnels through it. */

/** The spaces the user may hide or reorder. Home and Account are pinned —
 * Home is the front door, Account holds the editor (you can't lock yourself
 * out). Food joins this list in phase 3. */
export { DOCK_CHOICES, type DockChoice } from "@/lib/spaces";

/** Reconcile a saved order with the canonical set: keep the saved order for
 * keys that still exist, drop unknowns, append newcomers at the end — so an
 * app update that adds a space can't strand a stale persisted layout. */
export function normalizeOrder<T extends string>(
  saved: readonly string[] | null | undefined,
  all: readonly T[],
): T[] {
  const keep = (saved ?? []).filter((k): k is T => (all as readonly string[]).includes(k));
  const missing = all.filter((k) => !keep.includes(k));
  return [...keep, ...missing];
}

/** A saved subset (e.g. the hidden set), filtered to keys that still exist. */
export function validKeys<T extends string>(
  saved: readonly string[] | undefined,
  all: readonly T[],
): T[] {
  return (saved ?? []).filter((k): k is T => (all as readonly string[]).includes(k));
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

export function toggleKey<T extends string>(hidden: readonly T[], key: T): T[] {
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
}
