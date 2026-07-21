import { kindOf, libraryExercise, prettyName } from "./library";
import type { RoutineItem } from "./types";

// The program catalog — famous training splits, each holding named routines
// built from verified library exercises (so every movement has its 3D demo).
// Bundled/static: Explore browses these; adding one creates real routines.

// A pool of verified library exercise IDs, referenced by friendly key so the
// routines below read like a plan, not a list of hashes.
const POOL = {
  benchPress: "EIeI8Vf",
  inclineBench: "3TZduzM",
  dbBench: "SpYC0Kp",
  shoulderPress: "znQUdHY",
  militaryPress: "wdRZISl",
  arnoldPress: "Xy4jlWA",
  lateralRaise: "DsgkuIt",
  frontRaise: "33AzZeV",
  fly: "yz9nUhF",
  chestPress: "DOoWcnA",
  pushdown: "3ZflifB",
  tricepsDip: "X6C6i5Y",
  closeGripBench: "WcHl7ru",
  deadlift: "ila4NZS",
  pullup: "lBDjFxJ",
  chinup: "T2mxWqc",
  bentRow: "eZyBC3j",
  dbRow: "BJ0Hz5L",
  seatedRow: "fUBheHs",
  latPulldown: "ecpY0rH",
  tbarRow: "FVM1AUZ",
  shrug: "dG7tG5y",
  barbellCurl: "6TG6x2w",
  inclineCurl: "ae9UoXQ",
  hammerCurl: "GNhAeJ0",
  concentrationCurl: "lyKCLmK",
  rearDeltRow: "G61cXLk",
  squat: "qXTaZnJ",
  frontSquat: "zG0zs85",
  rdl: "wQ2c4XD",
  legExtension: "my33uHU",
  legCurl: "17lJ1kr",
  seatedLegCurl: "Zg3XY7P",
  calfRaise: "dPmaUaU",
  barbellCalf: "8ozhUIZ",
  lunge: "t8iSghb",
  legPress: "tj41Nu6",
  goodMorning: "JrOHAZc",
  powerClean: "SiWCcTN",
  plank: "VBAWRPG",
  crunch: "kjJ3VoQ",
  hangingLegRaise: "I3tsCnC",
} as const;

type PoolKey = keyof typeof POOL;
// [poolKey, sets, reps (or seconds), rest seconds]
type Line = [PoolKey, number, number, number];

function item([key, sets, reps, rest]: Line): RoutineItem | null {
  const ex = libraryExercise(POOL[key]);
  if (!ex) return null;
  return {
    name: prettyName(ex.name),
    kind: kindOf(ex),
    libId: ex.id,
    sets,
    target_reps: reps,
    target_weight: 0,
    rest,
  };
}

function routine(name: string, lines: Line[]) {
  return { name, items: lines.map(item).filter((i): i is RoutineItem => i !== null) };
}

export interface ProgramRoutine {
  name: string;
  items: RoutineItem[];
}

export interface Program {
  key: string;
  name: string;
  split: string; // one-line structure
  days: string; // typical days/week
  bestFor: string;
  description: string;
  routines: ProgramRoutine[];
}

export const PROGRAMS: Program[] = [
  {
    key: "ppl",
    name: "Push / Pull / Legs",
    split: "Push · Pull · Legs",
    days: "3–6 days/week",
    bestFor: "Intermediate — flexible volume",
    description:
      "The classic rotation: pressing muscles one day, pulling the next, legs the third. Run it 3 days for a full week, or twice through for 6.",
    routines: [
      routine("Push", [
        ["benchPress", 4, 6, 180],
        ["shoulderPress", 3, 8, 120],
        ["inclineBench", 3, 10, 120],
        ["lateralRaise", 3, 15, 60],
        ["pushdown", 3, 12, 60],
      ]),
      routine("Pull", [
        ["deadlift", 3, 5, 180],
        ["pullup", 3, 8, 120],
        ["bentRow", 3, 8, 120],
        ["seatedRow", 3, 12, 75],
        ["barbellCurl", 3, 10, 60],
      ]),
      routine("Legs", [
        ["squat", 4, 6, 180],
        ["rdl", 3, 8, 150],
        ["legPress", 3, 12, 90],
        ["legCurl", 3, 12, 75],
        ["calfRaise", 4, 15, 60],
      ]),
    ],
  },
  {
    key: "upper-lower",
    name: "Upper / Lower",
    split: "Upper · Lower",
    days: "4 days/week",
    bestFor: "Beginner–intermediate — great frequency",
    description:
      "Alternate upper- and lower-body days. Four days a week hits everything twice with room to recover.",
    routines: [
      routine("Upper", [
        ["benchPress", 4, 8, 150],
        ["bentRow", 4, 8, 150],
        ["shoulderPress", 3, 10, 90],
        ["latPulldown", 3, 12, 75],
        ["barbellCurl", 3, 12, 60],
        ["pushdown", 3, 12, 60],
      ]),
      routine("Lower", [
        ["squat", 4, 8, 180],
        ["rdl", 3, 10, 150],
        ["legPress", 3, 12, 90],
        ["legCurl", 3, 12, 75],
        ["calfRaise", 4, 15, 60],
      ]),
    ],
  },
  {
    key: "full-body",
    name: "Full Body",
    split: "Whole body each session",
    days: "2–4 days/week",
    bestFor: "Beginners — time-efficient",
    description:
      "One session trains everything. Alternate the A and B days so nothing gets stale.",
    routines: [
      routine("Full Body A", [
        ["squat", 3, 8, 150],
        ["benchPress", 3, 8, 150],
        ["bentRow", 3, 8, 120],
        ["shoulderPress", 3, 10, 90],
        ["plank", 3, 45, 60],
      ]),
      routine("Full Body B", [
        ["deadlift", 3, 5, 180],
        ["chestPress", 3, 10, 120],
        ["latPulldown", 3, 12, 90],
        ["lunge", 3, 10, 90],
        ["hangingLegRaise", 3, 12, 60],
      ]),
    ],
  },
  {
    key: "bro-split",
    name: "Bro Split",
    split: "One muscle a day",
    days: "5 days/week",
    bestFor: "Bodybuilding — high volume per muscle",
    description:
      "A day each for chest, back, legs, shoulders and arms — maximal volume on one group at a time.",
    routines: [
      routine("Chest", [
        ["benchPress", 4, 8, 150],
        ["inclineBench", 3, 10, 120],
        ["chestPress", 3, 12, 90],
        ["fly", 3, 15, 60],
        ["tricepsDip", 3, 12, 75],
      ]),
      routine("Back", [
        ["deadlift", 3, 5, 180],
        ["pullup", 3, 8, 120],
        ["tbarRow", 3, 10, 120],
        ["seatedRow", 3, 12, 75],
        ["shrug", 3, 15, 60],
      ]),
      routine("Legs", [
        ["squat", 4, 8, 180],
        ["legPress", 3, 12, 90],
        ["rdl", 3, 10, 150],
        ["legExtension", 3, 15, 60],
        ["calfRaise", 4, 15, 60],
      ]),
      routine("Shoulders", [
        ["shoulderPress", 4, 8, 120],
        ["lateralRaise", 4, 15, 60],
        ["frontRaise", 3, 12, 60],
        ["rearDeltRow", 3, 15, 60],
        ["shrug", 3, 15, 60],
      ]),
      routine("Arms", [
        ["barbellCurl", 4, 10, 75],
        ["closeGripBench", 4, 10, 90],
        ["hammerCurl", 3, 12, 60],
        ["pushdown", 3, 12, 60],
        ["concentrationCurl", 3, 15, 45],
      ]),
    ],
  },
  {
    key: "arnold",
    name: "Arnold Split",
    split: "Chest+Back · Shoulders+Arms · Legs",
    days: "6 days/week",
    bestFor: "Advanced — high volume & frequency",
    description:
      "Golden-era antagonist pairing, run twice a week: chest with back, shoulders with arms, then legs.",
    routines: [
      routine("Chest & Back", [
        ["benchPress", 4, 8, 150],
        ["bentRow", 4, 8, 150],
        ["inclineBench", 3, 10, 120],
        ["pullup", 3, 10, 90],
        ["fly", 3, 15, 60],
      ]),
      routine("Shoulders & Arms", [
        ["shoulderPress", 4, 8, 120],
        ["lateralRaise", 4, 15, 60],
        ["barbellCurl", 4, 10, 75],
        ["closeGripBench", 4, 10, 90],
        ["hammerCurl", 3, 12, 60],
      ]),
      routine("Legs", [
        ["squat", 5, 8, 180],
        ["legPress", 4, 12, 90],
        ["legCurl", 4, 12, 75],
        ["calfRaise", 5, 15, 60],
      ]),
    ],
  },
  {
    key: "phul",
    name: "PHUL",
    split: "Power + Hypertrophy, Upper/Lower",
    days: "4 days/week",
    bestFor: "Intermediate — strength + size",
    description:
      "Power Hypertrophy Upper Lower: two heavy power days and two higher-rep hypertrophy days.",
    routines: [
      routine("Power Upper", [
        ["benchPress", 4, 5, 180],
        ["bentRow", 4, 5, 180],
        ["shoulderPress", 3, 6, 120],
        ["pullup", 3, 6, 120],
        ["barbellCurl", 3, 8, 75],
      ]),
      routine("Power Lower", [
        ["squat", 4, 5, 180],
        ["deadlift", 3, 5, 180],
        ["legPress", 3, 10, 120],
        ["calfRaise", 4, 12, 60],
      ]),
      routine("Hypertrophy Upper", [
        ["inclineBench", 4, 12, 90],
        ["seatedRow", 4, 12, 90],
        ["lateralRaise", 4, 15, 60],
        ["fly", 3, 15, 60],
        ["hammerCurl", 3, 12, 60],
        ["pushdown", 3, 15, 60],
      ]),
      routine("Hypertrophy Lower", [
        ["frontSquat", 4, 12, 120],
        ["rdl", 3, 12, 90],
        ["legExtension", 4, 15, 60],
        ["seatedLegCurl", 4, 15, 60],
        ["calfRaise", 4, 20, 45],
      ]),
    ],
  },
  {
    key: "stronglifts",
    name: "StrongLifts 5×5",
    split: "Two workouts, A / B",
    days: "3 days/week",
    bestFor: "Beginners — simple strength",
    description:
      "Five sets of five on the big lifts, alternating A and B three times a week. Add weight every session.",
    routines: [
      routine("Workout A", [
        ["squat", 5, 5, 180],
        ["benchPress", 5, 5, 180],
        ["bentRow", 5, 5, 150],
      ]),
      routine("Workout B", [
        ["squat", 5, 5, 180],
        ["militaryPress", 5, 5, 180],
        ["deadlift", 1, 5, 180],
      ]),
    ],
  },
  {
    key: "starting-strength",
    name: "Starting Strength",
    split: "Barbell linear progression, A / B",
    days: "3 days/week",
    bestFor: "Beginners — pure strength",
    description:
      "Barbell basics with linear progression — squat every session, alternating the presses, deadlift and power clean.",
    routines: [
      routine("Workout A", [
        ["squat", 3, 5, 180],
        ["benchPress", 3, 5, 180],
        ["deadlift", 1, 5, 180],
      ]),
      routine("Workout B", [
        ["squat", 3, 5, 180],
        ["militaryPress", 3, 5, 180],
        ["powerClean", 5, 3, 150],
      ]),
    ],
  },
];
