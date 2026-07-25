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

/** The same hue, re-lit. Colour fields need an accent pale enough to carry ink
 * and stamps need one dark enough to read on it — both must stay recognisably
 * the token they came from, which alpha over paper can't guarantee. */
export function relight(hslColor: string, s: number, l: number): string {
  const hue = hslColor.match(/hsla?\(\s*([\d.]+)/)?.[1] ?? "0";
  return `hsl(${hue}, ${s}%, ${l}%)`;
}
