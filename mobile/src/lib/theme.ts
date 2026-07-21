// DOOEY's palette shape — concrete hsl() colors resolved per theme + Style
// studio overrides in stores/theme.ts, since React Native has no CSS variables.

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

/** An `hsl(...)` palette color at reduced opacity. */
export function alpha(hslColor: string, a: number): string {
  return hslColor.replace("hsl(", "hsla(").replace(")", `, ${a})`);
}
