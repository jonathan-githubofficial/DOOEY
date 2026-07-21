import { PROGRAMS } from "./programs";

// The routines seeded on first open — the Push/Pull/Legs split from the
// catalog, so the gym is alive on arrival with real, demonstrated exercises.
const PPL = PROGRAMS.find((p) => p.key === "ppl")!;

export const STARTER_ROUTINES = PPL.routines.map((r) => ({
  name: r.name,
  description: `${PPL.name} — ${r.name.toLowerCase()} day`,
  items: r.items,
}));
