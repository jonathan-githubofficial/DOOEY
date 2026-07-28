import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { busiestSide, canonicalMuscle, paintOf, paintSide, placementsFor, SLUGS_ON } from "./anatomy";
import { exerciseMuscles, LIBRARY } from "./library";

/** Read the slugs the body-highlighter package actually draws on one view.
 *
 * The point of this file: `SLUGS_ON` is hand-written, and a wrong entry there
 * is invisible — the muscle just never lights, which is exactly the bug this
 * work fixed. Diffing against the package's own assets means a version bump
 * that moves a part fails a test instead of quietly losing a shoulder. */
function slugsInAsset(file: string): string[] {
  const require = createRequire(__filename);
  const path = require.resolve(`react-native-body-highlighter/dist/assets/${file}.js`);
  const src = readFileSync(path, "utf8");
  return [...new Set([...src.matchAll(/slug: *"([a-z-]+)"/g)].map((m) => m[1]))].sort();
}

describe("SLUGS_ON matches the figure's own assets", () => {
  it("front", () => {
    expect([...SLUGS_ON.front].sort()).toEqual(slugsInAsset("bodyFront"));
  });
  it("back", () => {
    expect([...SLUGS_ON.back].sort()).toEqual(slugsInAsset("bodyBack"));
  });
});

describe("placementsFor", () => {
  it("places a muscle on both sides when the figure draws it on both", () => {
    for (const muscle of ["delts", "forearms", "calves", "triceps", "traps", "adductors"]) {
      expect(placementsFor(muscle).map((p) => p.side).sort()).toEqual(["back", "front"]);
    }
  });
  it("keeps a one-sided muscle on its own side", () => {
    expect(placementsFor("pectorals")).toEqual([{ slug: "chest", side: "front" }]);
    expect(placementsFor("hamstrings")).toEqual([{ slug: "hamstring", side: "back" }]);
  });
  it("places nothing for cardio or an unknown muscle", () => {
    expect(placementsFor("cardiovascular system")).toEqual([]);
    expect(placementsFor("gills")).toEqual([]);
  });
});

describe("canonicalMuscle", () => {
  it("folds the dataset's loose synonyms onto one name", () => {
    expect(canonicalMuscle("shoulders")).toBe("delts");
    expect(canonicalMuscle("rear deltoids")).toBe("delts");
    expect(canonicalMuscle("core")).toBe("abs");
    expect(canonicalMuscle("latissimus dorsi")).toBe("lats");
    expect(canonicalMuscle("soleus")).toBe("calves");
  });
  it("passes a primary name through untouched", () => {
    expect(canonicalMuscle("pectorals")).toBe("pectorals");
  });
  it("reads grip and wrist work as the forearms that do it", () => {
    for (const n of ["wrists", "wrist extensors", "wrist flexors", "grip muscles"]) {
      expect(canonicalMuscle(n)).toBe("forearms");
    }
  });
  it("resolves joints to nothing — they are not muscles the figure shades", () => {
    for (const n of ["hands", "feet", "ankles", "ankle stabilizers"]) {
      expect(canonicalMuscle(n)).toBe("");
    }
  });
});

describe("exerciseMuscles", () => {
  it("never repeats a primary muscle as secondary", () => {
    const { primary, secondary } = exerciseMuscles({
      targets: ["biceps"],
      secondary: ["biceps", "brachialis", "forearms"],
    });
    expect(primary).toEqual(["biceps"]);
    expect(secondary).toEqual(["forearms"]);
  });
  it("reads real compound lifts as more than one muscle", () => {
    const squat = LIBRARY.find((e) => e.name === "barbell full squat")!;
    const { primary, secondary } = exerciseMuscles(squat);
    expect(primary).toEqual(["glutes"]);
    expect(secondary).toEqual(expect.arrayContaining(["quads", "hamstrings"]));
  });
});

describe("the whole library resolves", () => {
  it("gives every non-cardio exercise at least one placeable muscle", () => {
    const orphans = LIBRARY.filter((ex) => {
      if (ex.targets.includes("cardiovascular system")) return false;
      const { primary, secondary } = exerciseMuscles(ex);
      return [...primary, ...secondary].every((m) => placementsFor(m).length === 0);
    });
    expect(orphans.map((e) => e.name)).toEqual([]);
  });
  it("leaves no secondary muscle name unmapped", () => {
    const unknown = new Set<string>();
    for (const ex of LIBRARY) {
      for (const raw of ex.secondary) {
        const m = canonicalMuscle(raw);
        // "" is a deliberate drop (joints, grip); a name that survives
        // canonicalization but places nowhere is a hole in the table.
        if (m && placementsFor(m).length === 0) unknown.add(raw);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});

describe("paintSide", () => {
  const RED = "hsl(0, 50%, 50%)";
  it("lets the stronger claim win a shared slug", () => {
    // lats and rhomboids both land on "upper-back".
    const painted = paintOf(["lats"], ["rhomboids"], RED);
    expect(paintSide(painted, "back").get("upper-back")).toEqual({ color: RED, strong: true });
  });
  it("does not let a secondary muscle downgrade a primary one", () => {
    const painted = paintOf(["rhomboids"], ["lats"], RED);
    expect(paintSide(painted, "back").get("upper-back")?.strong).toBe(true);
  });
  it("drops muscles that do not show on the asked-for side", () => {
    expect(paintSide(paintOf(["pectorals"], [], RED), "back").size).toBe(0);
  });
});

describe("busiestSide", () => {
  it("turns the figure to where the primary work is", () => {
    expect(busiestSide(paintOf(["glutes", "hamstrings"], [], "x"))).toBe("back");
    expect(busiestSide(paintOf(["pectorals"], [], "x"))).toBe("front");
  });
  it("is not spun by incidental shading", () => {
    expect(busiestSide(paintOf(["pectorals"], ["glutes", "hamstrings", "spine"], "x"))).toBe("front");
  });
  it("faces front when nothing is painted", () => {
    expect(busiestSide(new Map())).toBe("front");
  });
});
