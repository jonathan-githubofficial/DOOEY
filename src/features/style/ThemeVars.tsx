import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useThemeStore } from "@/stores";
import { useStyleStore } from "./store";
import { COLOR_TOKENS, DEFAULT_COLORS, FONT_STACKS, type FontKey, type Mode } from "./tokens";

// The Lynx theme mechanism (unit 3.4; ruling R11; SPEC 1). It REPLACES the src-legacy approach,
// which set the palette on `document.documentElement` (`:root`/`.dark` in global.css + inline
// overrides written by applyStyle/applyTheme). On the Lynx WEB target the app runs in a Web
// Worker with NO document/`:root`/`html` to write to, so the mode + palette are driven from a
// REACTIVE root <view> instead.
//
// Verified against the Lynx CSS docs (FETCHED, the tiebreaker per the crib):
//   - CSS variables: "the inheritance and priority of CSS variables also follow the CSS cascading
//     rules. If no CSS variable is defined on an element, the value of that variable is inherited
//     from its parent element." (https://lynxjs.org/api/css/properties/css-variable.html) -> the
//     variables emitted inline here CASCADE to every descendant, exactly what the mechanism needs
//     (the crib's "CSS variables ... supported" / "CSS variables DO cascade" is confirmed, NOT
//     contradicted, so SPEC 1's STOP condition does not fire).
//   - Theming: Lynx documents BOTH "Using CSS Descendant Selectors to Switch Themes" (toggle a
//     class on a parent element to drive `.theme .descendant` rules) AND "Using CSS Variables to
//     Switch Themes" (mount vars on an ancestor node). This component uses BOTH together:
//       * INLINE VARS carry the resolved palette so per-token studio edits + presets apply live
//         (this is the runtime override layer that used to live on document.documentElement).
//       * The `dark` CLASS activates the mode-conditional STYLE rules that are NOT variables and
//         so cannot be expressed as inline vars: `.dark .grain-tile` (blend mode), `.dark
//         .stamp-btn` (filter), the `dark:` Tailwind variants in the L2 primitives, and global
//         .css's `.dark { ... }` block (tailwind darkMode:'class'). The Phase-0 spike proved
//         `:root`/CSS-var tokens resolve on the web target (finding 3, enableCSSInlineVariables),
//         so global.css's `:root`/`.dark` blocks remain the factory-default fallback beneath the
//         inline overrides (nearer ancestor wins) - only the runtime-override source moved here.
//
// Mounted at the app root (src/router.tsx wraps the rootRoute's <Backdrop/> + <Outlet/>), so ALL
// screens - the backdrop and every routed page - are inside it and inherit the variables.

const stackOf = (key: FontKey) => FONT_STACKS.find((f) => f.key === key)!.stack;

// --soft-shadow is a var-of-var (it references --shadow-strength), so unlike a plain usage such
// as .grain-tile's `opacity: calc(... var(--grain-strength))` it is resolved AT ITS DECLARING
// element. Declaring it here (not only on global.css's :root/.dark) means it resolves against the
// --shadow-strength ALSO emitted here, so the "Shadows" slider stays live. The two mode variants
// mirror global.css verbatim (light warm-grey vs dark black, matching alphas).
const SOFT_SHADOW: Record<Mode, string> = {
  light:
    "0 1px 1px rgb(40 32 24 / calc(0.04 * var(--shadow-strength, 1))), 0 3px 8px -4px rgb(40 32 24 / calc(0.06 * var(--shadow-strength, 1)))",
  dark: "0 1px 1px rgb(0 0 0 / calc(0.25 * var(--shadow-strength, 1))), 0 3px 8px -4px rgb(0 0 0 / calc(0.35 * var(--shadow-strength, 1)))",
};

export function ThemeVars({ children }: { children?: ReactNode }) {
  const mode = useThemeStore((s) => s.theme) as Mode;
  const colors = useStyleStore((s) => s.colors);
  const fontSans = useStyleStore((s) => s.fontSans);
  const fontDisplay = useStyleStore((s) => s.fontDisplay);
  const radius = useStyleStore((s) => s.radius);
  const grain = useStyleStore((s) => s.grain);
  const shadow = useStyleStore((s) => s.shadow);

  // Port of applyStyle + DEFAULT_COLORS: ALWAYS emit a value for every token (there is no :root
  // fallback to rely on inside the cascade on Lynx), so the root view carries the full palette,
  // not just the studio's overrides.
  const vars: Record<string, string> = {};
  for (const { key } of COLOR_TOKENS) {
    vars[`--${key}`] = colors[mode][key] ?? DEFAULT_COLORS[mode][key];
  }
  vars["--app-font-sans"] = stackOf(fontSans);
  vars["--app-font-display"] = stackOf(fontDisplay);
  vars["--app-radius-card"] = `${radius}rem`;
  // global.css maps --radius-card -> var(--app-radius-card) on :root, but that resolves against
  // :root's --app-radius-card, so emit it here too (Panel uses rounded-[var(--radius-card)]).
  vars["--radius-card"] = `${radius}rem`;
  vars["--grain-strength"] = String(grain);
  vars["--shadow-strength"] = String(shadow);
  vars["--soft-shadow"] = SOFT_SHADOW[mode];

  return (
    <view
      data-testid="theme-root"
      className={cn("min-h-dvh w-full", mode === "dark" && "dark")}
      style={vars}
    >
      {children}
    </view>
  );
}
