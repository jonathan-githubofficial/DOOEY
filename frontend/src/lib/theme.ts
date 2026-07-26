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

/** `#rrggbb` for a palette colour. Skia parses hex, not `hsl()`, so the ink
 * layer converts on the way in rather than keeping a second set of literals. */
export function hslToHex(hslColor: string): string {
  const [h, s, l] = (hslColor.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
