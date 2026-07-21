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
export type Palette = Partial<Record<ColorKey, string>>;

/** Factory palette — mirrors the `:root` / `.dark` triplets in styles/global.css. */
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

/** Only stacks that need no extra font downloads: the two bundled fonts plus system
 * families. The lead family MUST match a real @font-face name from styles/fonts.css
 * ("Outfit-400"/"Fraunces-700", one family per weight instance - Lynx ignores
 * font-weight on @font-face). The old "Outfit Variable"/"Fraunces Variable" names had
 * no matching @font-face, so a bare `font-sans`/`font-display` (which resolves through
 * var(--app-font-*)) fell straight through to the generic serif/sans fallback. */
export const FONT_STACKS = [
  { key: "outfit", label: "Outfit", stack: `"Outfit-400", system-ui, sans-serif` },
  { key: "fraunces", label: "Fraunces", stack: `"Fraunces-700", Georgia, serif` },
  { key: "system", label: "System", stack: `system-ui, -apple-system, "Segoe UI", sans-serif` },
  { key: "serif", label: "Georgia", stack: `Georgia, "Times New Roman", serif` },
  { key: "mono", label: "Mono", stack: `ui-monospace, "Cascadia Code", Consolas, monospace` },
] as const;

export type FontKey = (typeof FONT_STACKS)[number]["key"];

export interface Preset {
  key: string;
  label: string;
  colors: Record<Mode, Palette>;
}

/** One-tap palettes. Untouched tokens fall back to the factory palette, so
 * presets only pin down the surfaces + the accent. */
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

/** "20 82% 54%" → "#e8641f" — for feeding <input type="color">. */
export function tripletToHex(triplet: string): string {
  const m = triplet.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return "#000000";
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** "#e8641f" → "20 82% 52%" — the HSL triplet shape global.css expects. */
export function hexToTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
