import { Platform, type TextStyle } from "react-native";

export type Mode = "light" | "dark";

export const COLOR_TOKENS = [
  { key: "paper", label: "Paper", hint: "page background" },
  { key: "surface", label: "Surface", hint: "cards & panels" },
  { key: "ink", label: "Ink", hint: "text" },
  { key: "ink-muted", label: "Muted ink", hint: "secondary text" },
  { key: "rule", label: "Rule", hint: "borders & hairlines" },
  { key: "zest", label: "Zest", hint: "accent & highlights" },
  { key: "leaf", label: "Leaf", hint: "done / positive" },
  { key: "sky", label: "Sky", hint: "category blue" },
  { key: "clay", label: "Clay", hint: "category red" },
  { key: "honey", label: "Honey", hint: "category amber" },
] as const;

export type ColorKey = (typeof COLOR_TOKENS)[number]["key"];
export type PaletteOverrides = Partial<Record<ColorKey, string>>;

/** Factory palette — the same HSL triplets as the web app's global.css. */
export const DEFAULT_COLORS: Record<Mode, Record<ColorKey, string>> = {
  light: {
    paper: "44 26% 95%",
    surface: "44 40% 99%",
    ink: "28 12% 14%",
    "ink-muted": "28 7% 45%",
    rule: "30 14% 84%",
    zest: "20 82% 54%",
    leaf: "148 34% 38%",
    sky: "208 66% 52%",
    clay: "10 60% 53%",
    honey: "36 78% 50%",
  },
  dark: {
    paper: "28 10% 9%",
    surface: "28 9% 13%",
    ink: "42 22% 92%",
    "ink-muted": "30 7% 60%",
    rule: "30 8% 24%",
    zest: "20 82% 62%",
    leaf: "148 36% 58%",
    sky: "205 66% 63%",
    clay: "10 64% 63%",
    honey: "40 80% 62%",
  },
};

/** "20 82% 54%" → an RN-parseable hsl(). */
export function tripletToHsl(triplet: string): string {
  const [h, s, l] = triplet.split(" ");
  return `hsl(${h}, ${s}, ${l})`;
}

export function parseTriplet(triplet: string): { h: number; s: number; l: number } {
  const m = triplet.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return { h: 0, s: 0, l: 0 };
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

export function formatTriplet(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

/** Font choices — the mobile take on the web's FONT_STACKS: the two bundled
 * families plus system stacks resolved per platform. */
export const FONT_CHOICES = [
  { key: "outfit", label: "Outfit" },
  { key: "fraunces", label: "Fraunces" },
  { key: "system", label: "System" },
  { key: "serif", label: "Georgia" },
  { key: "mono", label: "Mono" },
] as const;

export type FontKey = (typeof FONT_CHOICES)[number]["key"];

type Weight = "400" | "500" | "600" | "700" | "900";

const LOADED: Record<"outfit" | "fraunces", Record<Weight, string>> = {
  outfit: {
    "400": "Outfit_400Regular",
    "500": "Outfit_500Medium",
    "600": "Outfit_600SemiBold",
    "700": "Outfit_700Bold",
    "900": "Outfit_900Black",
  },
  fraunces: {
    "400": "Fraunces_400Regular",
    "500": "Fraunces_500Medium",
    "600": "Fraunces_600SemiBold",
    "700": "Fraunces_700Bold",
    "900": "Fraunces_900Black",
  },
};

/** A text-style fragment for one font choice at one weight. Bundled fonts pin
 * an exact family; system stacks lean on fontWeight instead. */
export function fontStyle(key: FontKey, weight: Weight): TextStyle {
  if (key === "outfit" || key === "fraunces") return { fontFamily: LOADED[key][weight] };
  if (key === "serif") {
    return {
      fontFamily: Platform.OS === "android" ? "serif" : "Georgia",
      fontWeight: weight,
    };
  }
  if (key === "mono") {
    return {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontWeight: weight,
    };
  }
  return { fontWeight: weight }; // system
}

export interface Preset {
  key: string;
  label: string;
  colors: Record<Mode, PaletteOverrides>;
}

/** One-tap palettes — same values as the web app. Untouched tokens fall back
 * to the factory palette, so presets only pin down surfaces + accent. */
export const PRESETS: Preset[] = [
  { key: "dooey", label: "Dooey", colors: { light: {}, dark: {} } },
  {
    key: "meadow",
    label: "Meadow",
    colors: {
      light: {
        paper: "96 22% 94%",
        surface: "90 36% 98%",
        ink: "140 12% 13%",
        "ink-muted": "140 6% 42%",
        rule: "100 12% 82%",
        zest: "152 46% 37%",
      },
      dark: {
        paper: "150 10% 8%",
        surface: "150 8% 12%",
        ink: "110 18% 90%",
        "ink-muted": "130 6% 58%",
        rule: "140 7% 22%",
        zest: "150 42% 56%",
      },
    },
  },
  {
    key: "tide",
    label: "Tide",
    colors: {
      light: {
        paper: "210 32% 95%",
        surface: "210 45% 99%",
        ink: "215 22% 14%",
        "ink-muted": "213 10% 44%",
        rule: "210 16% 83%",
        zest: "208 74% 47%",
      },
      dark: {
        paper: "216 20% 9%",
        surface: "215 16% 13%",
        ink: "210 24% 91%",
        "ink-muted": "212 10% 60%",
        rule: "213 10% 23%",
        zest: "206 72% 62%",
      },
    },
  },
  {
    key: "plum",
    label: "Plum",
    colors: {
      light: {
        paper: "336 30% 95%",
        surface: "336 45% 99%",
        ink: "330 16% 13%",
        "ink-muted": "330 7% 44%",
        rule: "334 14% 84%",
        zest: "330 62% 50%",
      },
      dark: {
        paper: "326 14% 9%",
        surface: "326 11% 13%",
        ink: "335 20% 91%",
        "ink-muted": "330 7% 60%",
        rule: "330 8% 23%",
        zest: "332 66% 66%",
      },
    },
  },
  {
    key: "charcoal",
    label: "Charcoal",
    colors: {
      light: {
        paper: "40 6% 94%",
        surface: "40 8% 99%",
        ink: "220 8% 10%",
        "ink-muted": "220 4% 42%",
        rule: "40 5% 82%",
        zest: "220 8% 20%",
      },
      dark: {
        paper: "220 6% 8%",
        surface: "220 5% 12%",
        ink: "40 8% 92%",
        "ink-muted": "220 4% 60%",
        rule: "220 5% 22%",
        zest: "40 12% 80%",
      },
    },
  },
];

/** Backdrops: quiet colour washes breathed diagonally over the paper — always
 * through the palette (so presets and dark mode re-ink them) and always at
 * single-digit opacities, so the paper stays paper. */
export const BACKDROPS = [
  { key: "dawn", label: "Dawn", from: "zest", to: "honey" },
  { key: "mist", label: "Mist", from: "sky", to: "rule" },
  { key: "moss", label: "Moss", from: "leaf", to: "sky" },
  { key: "ember", label: "Ember", from: "clay", to: "honey" },
  { key: "dusk", label: "Dusk", from: "sky", to: "clay" },
] as const;
export type BackdropKey = (typeof BACKDROPS)[number]["key"];

/** Pages that can wear a hand-drawn icon — keys shared with the web app's
 * user record, so doodles drawn on either client appear on both. */
export const DOODLE_PAGES = [
  { key: "planner", label: "Planner" },
  { key: "calendar", label: "Calendar" },
  { key: "boards", label: "Boards" },
  { key: "learning", label: "Projects" },
  { key: "account", label: "Account" },
  // Not a page: the little creature that lives in the planner's margin.
  { key: "companion", label: "Companion" },
] as const;
