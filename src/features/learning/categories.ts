import {
  BookOpen,
  Dumbbell,
  GraduationCap,
  Languages,
  Palette,
  type IconComponent,
} from "@/components/icons/lucide";

export interface CategoryStyle {
  label: string;
  Icon: IconComponent;
  /** Icon chip / badge background + text. */
  chip: string;
  /** Solid accent for progress fills, dots. */
  accent: string;
  /** Colored text (countdown number, links). */
  text: string;
  /** Rubber-stamp badge colors (text + border). */
  stamp: string;
  /** Raw CSS custom-property name for the category hue (for color-mix). */
  varName: string;
}

// Literal Tailwind class strings so the JIT compiler can see every one.
const STYLES = {
  sky: {
    label: "Language",
    Icon: Languages,
    chip: "bg-sky/15 text-sky",
    accent: "bg-sky",
    text: "text-sky",
    stamp: "text-sky border-sky/45",
    varName: "--sky",
  },
  zest: {
    label: "Fitness",
    Icon: Dumbbell,
    chip: "bg-zest/15 text-zest",
    accent: "bg-zest",
    text: "text-zest",
    stamp: "text-zest border-zest/45",
    varName: "--zest",
  },
  leaf: {
    label: "Study",
    Icon: GraduationCap,
    chip: "bg-leaf/15 text-leaf",
    accent: "bg-leaf",
    text: "text-leaf",
    stamp: "text-leaf border-leaf/45",
    varName: "--leaf",
  },
  clay: {
    label: "Craft",
    Icon: Palette,
    chip: "bg-clay/15 text-clay",
    accent: "bg-clay",
    text: "text-clay",
    stamp: "text-clay border-clay/45",
    varName: "--clay",
  },
  honey: {
    label: "Practice",
    Icon: BookOpen,
    chip: "bg-honey/20 text-honey",
    accent: "bg-honey",
    text: "text-honey",
    stamp: "text-honey border-honey/50",
    varName: "--honey",
  },
} satisfies Record<string, CategoryStyle>;

type Key = keyof typeof STYLES;
const ORDER: Key[] = ["sky", "zest", "leaf", "clay", "honey"];

/** All hues, for the folder-customization palette. */
export const CATEGORY_HUES = ORDER;

/** Look a category up by its hue (a folder's hand-picked color). */
export function categoryByHue(hue: Key): CategoryStyle {
  return STYLES[hue];
}

/** Infer a category (colour + icon + label) from the program goal, with a stable fallback. */
export function categoryFor(goal: string): CategoryStyle {
  const g = goal.toLowerCase();
  if (/\b(french|spanish|german|italian|english|japanese|mandarin|chinese|portuguese|arabic|korean|russian|language)\b/.test(g))
    return STYLES.sky;
  if (/\b(gym|fitness|muscle|run|running|workout|strength|lift|lifting|weight|marathon|yoga|cardio|hiit|pushup|calisthenics)\b/.test(g))
    return STYLES.zest;
  if (/\b(study|studying|exam|cert|certification|course|math|maths|science|aws|azure|degree|read|reading|history|physics|chemistry|biology|interview|system design)\b/.test(g))
    return STYLES.leaf;
  if (/\b(draw|drawing|paint|painting|music|guitar|piano|sing|singing|design|craft|lettering|art|photography|write|writing)\b/.test(g))
    return STYLES.clay;

  let h = 0;
  for (let i = 0; i < goal.length; i++) h = (h * 31 + goal.charCodeAt(i)) >>> 0;
  return STYLES[ORDER[h % ORDER.length]];
}
