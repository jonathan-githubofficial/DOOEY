import { PROGRAMS } from "./programs";

// Seeded on first open — the Push/Pull/Legs split as a real program, so the gym
// arrives alive with demonstrated exercises, grouped the way everything else is.
const PPL = PROGRAMS.find((p) => p.key === "ppl")!;

export const STARTER_PROGRAM = {
  name: PPL.name,
  description: PPL.split,
  routines: PPL.routines.map((r) => ({
    name: r.name,
    description: `${PPL.name} · ${r.name}`,
    items: r.items,
  })),
};
