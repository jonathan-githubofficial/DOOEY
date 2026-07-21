import type { Palette, ThemeName } from "@/lib/theme";

/** "96 22% 94%" (the web app's CSS-triplet form) → an RN-parseable hsl(). */
export function tripletToHsl(triplet: string): string {
  const [h, s, l] = triplet.split(" ");
  return `hsl(${h}, ${s}, ${l})`;
}

export interface Preset {
  key: string;
  label: string;
  /** Token overrides per mode; untouched tokens fall back to the factory palette. */
  colors: Record<ThemeName, Partial<Palette>>;
}

const preset = (
  key: string,
  label: string,
  colors: Record<ThemeName, Partial<Record<keyof Palette, string>>>,
): Preset => ({
  key,
  label,
  colors: {
    light: mapTriplets(colors.light),
    dark: mapTriplets(colors.dark),
  },
});

function mapTriplets(overrides: Partial<Record<keyof Palette, string>>): Partial<Palette> {
  const out: Partial<Palette> = {};
  for (const [k, v] of Object.entries(overrides)) out[k as keyof Palette] = tripletToHsl(v);
  return out;
}

/** One-tap palettes — same values as the web app's Style studio presets. */
export const PRESETS: Preset[] = [
  preset("dooey", "Dooey", { light: {}, dark: {} }),
  preset("meadow", "Meadow", {
    light: {
      paper: "96 22% 94%",
      surface: "90 36% 98%",
      ink: "140 12% 13%",
      inkMuted: "140 6% 42%",
      rule: "100 12% 82%",
      zest: "152 46% 37%",
    },
    dark: {
      paper: "150 10% 8%",
      surface: "150 8% 12%",
      ink: "110 18% 90%",
      inkMuted: "130 6% 58%",
      rule: "140 7% 22%",
      zest: "150 42% 56%",
    },
  }),
  preset("tide", "Tide", {
    light: {
      paper: "210 32% 95%",
      surface: "210 45% 99%",
      ink: "215 22% 14%",
      inkMuted: "213 10% 44%",
      rule: "210 16% 83%",
      zest: "208 74% 47%",
    },
    dark: {
      paper: "216 20% 9%",
      surface: "215 16% 13%",
      ink: "210 24% 91%",
      inkMuted: "212 10% 60%",
      rule: "213 10% 23%",
      zest: "206 72% 62%",
    },
  }),
  preset("plum", "Plum", {
    light: {
      paper: "336 30% 95%",
      surface: "336 45% 99%",
      ink: "330 16% 13%",
      inkMuted: "330 7% 44%",
      rule: "334 14% 84%",
      zest: "330 62% 50%",
    },
    dark: {
      paper: "326 14% 9%",
      surface: "326 11% 13%",
      ink: "335 20% 91%",
      inkMuted: "330 7% 60%",
      rule: "330 8% 23%",
      zest: "332 66% 66%",
    },
  }),
  preset("charcoal", "Charcoal", {
    light: {
      paper: "40 6% 94%",
      surface: "40 8% 99%",
      ink: "220 8% 10%",
      inkMuted: "220 4% 42%",
      rule: "40 5% 82%",
      zest: "220 8% 20%",
    },
    dark: {
      paper: "220 6% 8%",
      surface: "220 5% 12%",
      ink: "40 8% 92%",
      inkMuted: "220 4% 60%",
      rule: "220 5% 22%",
      zest: "40 12% 80%",
    },
  }),
];

/** Card corner options — the mobile take on the web's radius slider. */
export const RADII = [
  { key: "crisp", label: "Crisp", value: 14 },
  { key: "soft", label: "Soft", value: 24 },
  { key: "round", label: "Round", value: 32 },
] as const;

/** Grain strength steps — multiplier on the default texture opacity. */
export const GRAINS = [
  { key: "off", label: "Off", value: 0 },
  { key: "subtle", label: "Subtle", value: 1 },
  { key: "strong", label: "Strong", value: 1.8 },
] as const;
