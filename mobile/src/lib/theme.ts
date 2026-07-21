// DOOEY's palette — the same warm paper + ink tokens as the web app's
// global.css, resolved to concrete colors per theme since React Native has no
// CSS variables.

export type ThemeName = "light" | "dark";

export interface Palette {
  paper: string;
  surface: string;
  ink: string;
  inkMuted: string;
  rule: string;
  leaf: string;
  zest: string;
  sky: string;
  clay: string;
  honey: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    paper: "hsl(44, 26%, 95%)",
    surface: "hsl(44, 40%, 99%)",
    ink: "hsl(28, 12%, 14%)",
    inkMuted: "hsl(28, 7%, 45%)",
    rule: "hsl(30, 14%, 84%)",
    leaf: "hsl(148, 34%, 38%)",
    zest: "hsl(20, 82%, 54%)",
    sky: "hsl(208, 66%, 52%)",
    clay: "hsl(10, 60%, 53%)",
    honey: "hsl(36, 78%, 50%)",
  },
  dark: {
    paper: "hsl(28, 10%, 9%)",
    surface: "hsl(28, 9%, 13%)",
    ink: "hsl(42, 22%, 92%)",
    inkMuted: "hsl(30, 7%, 60%)",
    rule: "hsl(30, 8%, 24%)",
    leaf: "hsl(148, 36%, 58%)",
    zest: "hsl(20, 82%, 62%)",
    sky: "hsl(205, 66%, 63%)",
    clay: "hsl(10, 64%, 63%)",
    honey: "hsl(40, 80%, 62%)",
  },
};

/** An `hsl(...)` palette color at reduced opacity. */
export function alpha(hslColor: string, a: number): string {
  return hslColor.replace("hsl(", "hsla(").replace(")", `, ${a})`);
}

export const fonts = {
  sans: "Outfit_400Regular",
  sansMedium: "Outfit_500Medium",
  sansSemiBold: "Outfit_600SemiBold",
  display: "Fraunces_700Bold",
  displayBlack: "Fraunces_900Black",
} as const;
